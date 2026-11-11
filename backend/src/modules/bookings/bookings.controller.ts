import { Body, Controller, Get, Inject, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { bookingRefSchema, createBookingSchema, type CreateBookingInput } from './bookings.dto';
import { BookingsService } from './bookings.service';

@ApiTags('bookings')
@Controller('bookings')
export class BookingsController {
  constructor(@Inject(BookingsService) private readonly bookings: BookingsService) {}

  @Post()
  @ApiOperation({
    summary: 'Turn a live quote into a booking',
    description:
      'Consumes the quote atomically. Duplicate submissions return 409 rather than creating a second booking.',
  })
  create(@Body(new ZodValidationPipe(createBookingSchema)) body: CreateBookingInput) {
    return this.bookings.create(body);
  }

  @Get(':ref')
  @ApiOperation({ summary: 'Read a booking by reference' })
  get(@Param('ref', new ZodValidationPipe(bookingRefSchema)) ref: string) {
    return this.bookings.getByRef(ref);
  }

  @Post(':ref/cancel')
  @ApiOperation({ summary: 'Cancel a booking that has not started' })
  cancel(@Param('ref', new ZodValidationPipe(bookingRefSchema)) ref: string) {
    return this.bookings.cancelByRef(ref);
  }
}
