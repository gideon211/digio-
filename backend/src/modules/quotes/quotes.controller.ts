import { Body, Controller, Get, Inject, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { type CreateRentalQuoteInput, createRentalQuoteSchema } from '../rentals/rentals.dto';
import {
  type CompareTransfersInput,
  compareTransfersSchema,
  createChauffeurQuoteSchema,
} from './quotes.dto';
import { QuotesService } from './quotes.service';

@ApiTags('quotes')
@Controller('quotes')
export class QuotesController {
  constructor(@Inject(QuotesService) private readonly quotes: QuotesService) {}

  @Post('chauffeur')
  @ApiOperation({
    summary: 'Price a point-to-point chauffeur transfer',
    description:
      'Server resolves zone pair, vehicle class, extras and promos. The response token is the only ' +
      'input accepted by POST /bookings — the client never sends a price.',
  })
  createChauffeur(@Body(new ZodValidationPipe(createChauffeurQuoteSchema)) body: unknown) {
    return this.quotes.createChauffeurQuote(body as Parameters<QuotesService['createChauffeurQuote']>[0]);
  }

  @Post('transfer-compare')
  @ApiOperation({
    summary: 'Price every class on a route',
    description:
      'Runs the same pure engine the issued quote uses, for every class that has a fixed price on ' +
      'the route. Writes nothing and issues no token — browsing cannot reserve a car.',
  })
  compare(@Body(new ZodValidationPipe(compareTransfersSchema)) body: CompareTransfersInput) {
    return this.quotes.compareTransfers(body);
  }

  @Post('rental')
  @ApiOperation({
    summary: 'Price a self-drive rental or chauffeur day hire',
    description:
      'Pins a specific available vehicle for the date range. The quote is only valid while that ' +
      'vehicle stays free; POST /bookings fails with VEHICLE_UNAVAILABLE if it is taken.',
  })
  createRental(@Body(new ZodValidationPipe(createRentalQuoteSchema)) body: CreateRentalQuoteInput) {
    return this.quotes.createRentalQuote(body);
  }

  @Get(':token')
  @ApiOperation({ summary: 'Re-read a live quote' })
  get(@Param('token') token: string) {
    return this.quotes.getByToken(token);
  }
}
