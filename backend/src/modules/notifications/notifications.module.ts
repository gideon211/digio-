import {
  Inject,
  Logger,
  Module,
  type OnApplicationShutdown,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { SmsProvider } from './providers/sms.provider';
import { WhatsAppProvider } from './providers/whatsapp.provider';

const DISPATCH_INTERVAL_MS = 15_000;

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, WhatsAppProvider, SmsProvider],
  exports: [NotificationsService],
})
export class NotificationsModule implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(NotificationsModule.name);
  private timer?: NodeJS.Timeout;

  constructor(
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    const enabled = this.config.get<string>('NOTIFICATIONS_DISPATCH_ENABLED') !== 'false';
    if (!enabled || this.config.get<string>('NODE_ENV') === 'test') return;

    this.timer = setInterval(() => {
      void this.notifications
        .dispatchDue()
        .then((summary) => {
          if (summary.sent || summary.failed) {
            this.logger.log(
              `Outbox: ${summary.sent} sent, ${summary.failed} failed, ` +
                `${summary.retried} retried, ${summary.cancelled} fallbacks cancelled`,
            );
          }
        })
        .catch((error: Error) => this.logger.error(`Outbox dispatch failed: ${error.message}`));
    }, DISPATCH_INTERVAL_MS);

    // Do not hold the process open just for the dispatcher.
    this.timer.unref();
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
