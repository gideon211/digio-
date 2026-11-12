import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, asc, eq, inArray, lte, sql } from 'drizzle-orm';
import { DB, type Database } from '../../db/database.module';
import { notificationOutbox } from '../../db/schema';
import { SmsProvider } from './providers/sms.provider';
import { WhatsAppProvider } from './providers/whatsapp.provider';
import {
  renderBookingConfirmed,
  type BookingConfirmedPayload,
  type TemplateName,
} from './templates';

const MAX_ATTEMPTS = 5;
const BACKOFF_BASE_SECONDS = 30;

export interface DispatchSummary {
  sent: number;
  failed: number;
  retried: number;
  cancelled: number;
}
type OutboxRow = typeof notificationOutbox.$inferSelect;

/**
 * Drains the notification outbox.
 *
 * The outbox table is the queue: rows are written in the same transaction that
 * confirms a payment, so a crash between "paid" and "message queued" is
 * impossible. Claiming uses `FOR UPDATE SKIP LOCKED`, which keeps multiple API
 * instances from sending the same message.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(WhatsAppProvider) private readonly whatsapp: WhatsAppProvider,
    @Inject(SmsProvider) private readonly sms: SmsProvider,
  ) {}

  async dispatchDue(limit = 20): Promise<DispatchSummary> {
    const due = await this.claim(limit);
    const summary: DispatchSummary = { sent: 0, failed: 0, retried: 0, cancelled: 0 };

    for (const row of due) {
      try {
        const text = this.render(row);
        const result =
          row.channel === 'whatsapp'
            ? await this.whatsapp.send(row.recipient, text, row.template)
            : await this.sms.send(row.recipient, text);

        await this.db
          .update(notificationOutbox)
          .set({
            status: 'sent',
            sentAt: new Date(),
            providerRef: result.providerRef ?? null,
            lastError: result.delivered ? null : 'logged-only: provider not configured',
            updatedAt: new Date(),
          })
          .where(eq(notificationOutbox.id, row.id));

        summary.sent += 1;

        if (row.channel === 'whatsapp') {
          summary.cancelled += await this.cancelSmsFallback(row);
        }
      } catch (error) {
        const message = (error as Error).message;
        const exhausted = row.attempts + 1 >= MAX_ATTEMPTS;

        await this.db
          .update(notificationOutbox)
          .set({
            status: exhausted ? 'failed' : 'queued',
            lastError: message,
            nextAttemptAt: new Date(
              Date.now() + BACKOFF_BASE_SECONDS * 2 ** row.attempts * 1000,
            ),
            updatedAt: new Date(),
          })
          .where(eq(notificationOutbox.id, row.id));

        if (exhausted) {
          summary.failed += 1;
          this.logger.error(
            `Notification ${row.id} (${row.channel}/${row.template}) failed permanently: ${message}`,
          );
          if (row.channel === 'whatsapp') {
            await this.releaseSmsFallback(row);
          }
        } else {
          summary.retried += 1;
          this.logger.warn(
            `Notification ${row.id} (${row.channel}) attempt ${row.attempts} failed: ${message}`,
          );
        }
      }
    }

    return summary;
  }

  private async claim(limit: number): Promise<OutboxRow[]> {
    return this.db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(notificationOutbox)
        .where(
          and(
            eq(notificationOutbox.status, 'queued'),
            lte(notificationOutbox.nextAttemptAt, new Date()),
          ),
        )
        .orderBy(asc(notificationOutbox.nextAttemptAt))
        .limit(limit)
        .for('update', { skipLocked: true });

      if (rows.length === 0) return [];

      await tx
        .update(notificationOutbox)
        .set({
          status: 'sending',
          attempts: sql`${notificationOutbox.attempts} + 1`,
          updatedAt: new Date(),
        })
        .where(
          inArray(
            notificationOutbox.id,
            rows.map((row) => row.id),
          ),
        );

      return rows;
    });
  }

  /** WhatsApp landed, so the SMS safety net is no longer needed. */
  private async cancelSmsFallback(row: OutboxRow): Promise<number> {
    if (!row.bookingId) return 0;

    const cancelled = await this.db
      .update(notificationOutbox)
      .set({
        status: 'cancelled',
        lastError: 'whatsapp delivered',
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(notificationOutbox.bookingId, row.bookingId),
          eq(notificationOutbox.event, row.event),
          eq(notificationOutbox.channel, 'sms'),
          eq(notificationOutbox.status, 'queued'),
        ),
      )
      .returning({ id: notificationOutbox.id });

    return cancelled.length;
  }

  /** WhatsApp is unrecoverable, so send the SMS immediately. */
  private async releaseSmsFallback(row: OutboxRow): Promise<void> {
    if (!row.bookingId) return;

    await this.db
      .update(notificationOutbox)
      .set({ nextAttemptAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(notificationOutbox.bookingId, row.bookingId),
          eq(notificationOutbox.event, row.event),
          eq(notificationOutbox.channel, 'sms'),
          eq(notificationOutbox.status, 'queued'),
        ),
      );
  }

  private render(row: OutboxRow): string {
    const payload = row.payload as unknown as BookingConfirmedPayload;
    const template = row.template as TemplateName;

    if (template === 'booking_confirmed_v1') {
      return renderBookingConfirmed(row.channel, payload);
    }

    throw new Error(`Unknown template ${row.template}`);
  }

  async outboxFor(bookingRef: string): Promise<OutboxRow[]> {
    return this.db
      .select()
      .from(notificationOutbox)
      .where(sql`${notificationOutbox.bookingId} = (select id from bookings where ref = ${bookingRef})`)
      .orderBy(asc(notificationOutbox.createdAt));
  }
}
