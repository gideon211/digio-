import { Controller, Get, Inject, Param, Post } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';

/**
 * Internal operations surface. No customer-facing auth yet, so these routes are
 * hidden from the public OpenAPI document and gated by the admin token later.
 */
@ApiExcludeController()
@Controller('notifications')
export class NotificationsController {
  constructor(@Inject(NotificationsService) private readonly notifications: NotificationsService) {}

  @Post('dispatch')
  dispatch() {
    return this.notifications.dispatchDue(50);
  }

  @Get('outbox/:bookingRef')
  outbox(@Param('bookingRef') bookingRef: string) {
    return this.notifications.outboxFor(bookingRef);
  }
}
