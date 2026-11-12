import { Controller, Get, Inject, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { type RentalRangeInput, rentalRangeSchema, rentalWindow } from './rentals.dto';
import { RentalsService } from './rentals.service';

@ApiTags('rentals')
@Controller('rentals')
export class RentalsController {
  constructor(@Inject(RentalsService) private readonly rentals: RentalsService) {}

  @Get('availability')
  @ApiOperation({
    summary: 'Vehicles free for a date range',
    description:
      'Answers from the same daterange predicate that the exclusion constraint enforces, ' +
      'so a vehicle reported free can actually be reserved.',
  })
  async availability(@Query(new ZodValidationPipe(rentalRangeSchema)) query: RentalRangeInput) {
    const window = rentalWindow(query.fromDate, query.toDate);
    const vehicles = await this.rentals.availableVehicles(
      query.classSlug,
      window.fromDate,
      window.toDate,
    );

    return {
      classSlug: query.classSlug,
      fromDate: window.fromDate,
      toDate: window.toDate,
      days: window.days,
      vehicles,
    };
  }

  @Get('classes')
  @ApiOperation({ summary: 'Availability and day rates for every class' })
  async classes(@Query(new ZodValidationPipe(rentalRangeSchema.pick({ fromDate: true, toDate: true }))) query: {
    fromDate: string;
    toDate: string;
  }) {
    const window = rentalWindow(query.fromDate, query.toDate);
    return {
      fromDate: window.fromDate,
      toDate: window.toDate,
      days: window.days,
      classes: await this.rentals.classAvailability(window.fromDate, window.toDate),
    };
  }
}
