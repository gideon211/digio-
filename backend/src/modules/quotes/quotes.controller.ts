import { Body, Controller, Get, Inject, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { createChauffeurQuoteSchema } from './quotes.dto';
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

  @Get(':token')
  @ApiOperation({ summary: 'Re-read a live quote' })
  get(@Param('token') token: string) {
    return this.quotes.getByToken(token);
  }
}
