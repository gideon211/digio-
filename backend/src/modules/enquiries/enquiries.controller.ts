import { Body, Controller, Inject, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { createEnquirySchema, type CreateEnquiryInput } from './enquiries.dto';
import { EnquiriesService } from './enquiries.service';

@ApiTags('enquiries')
@Controller('enquiries')
export class EnquiriesController {
  constructor(@Inject(EnquiriesService) private readonly enquiries: EnquiriesService) {}

  @Post()
  @ApiOperation({
    summary: 'Ask about something we cannot price online',
    description:
      'Corporate accounts, weddings, long-term hire, private jets and yachts. These are quoted ' +
      'by a person, so this records the contact and returns a reference. No read endpoint: ' +
      'enquiries carry phone numbers and are worked from the database.',
  })
  create(@Body(new ZodValidationPipe(createEnquirySchema)) body: CreateEnquiryInput) {
    return this.enquiries.create(body);
  }
}
