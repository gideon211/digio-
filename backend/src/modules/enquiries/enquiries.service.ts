import { Inject, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { DB, type Database } from '../../db/database.module';
import { enquiries } from '../../db/schema';
import { normaliseGhanaPhone } from '../../common/refs';
import type { CreateEnquiryInput } from './enquiries.dto';

/**
 * There is deliberately no read endpoint here: enquiries carry phone numbers,
 * and nothing on the public API should list them. They are worked from the
 * database until an authenticated ops console exists.
 */
@Injectable()
export class EnquiriesService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async create(input: CreateEnquiryInput) {
    const phone = normaliseGhanaPhone(input.phone);
    if (!phone) {
      throw new UnprocessableEntityException({
        code: 'PHONE_INVALID',
        message: 'Enter a Ghana mobile number, e.g. 024 123 4567',
      });
    }

    const [row] = await this.db
      .insert(enquiries)
      .values({
        kind: input.kind,
        name: input.name,
        phone,
        email: input.email ?? null,
        message: input.message ?? null,
        payload: { source: 'web' },
      })
      .returning({ id: enquiries.id, kind: enquiries.kind, status: enquiries.status });

    if (!row) throw new Error('Failed to persist enquiry');

    return row;
  }
}
