import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CatalogService } from './catalog.service';

@ApiTags('catalog')
@Controller('catalog')
export class CatalogController {
  constructor(@Inject(CatalogService) private readonly catalog: CatalogService) {}

  @Get()
  @ApiOperation({ summary: 'Everything the booking UI needs to render step one' })
  async everything() {
    const [vehicleClasses, zones] = await Promise.all([
      this.catalog.vehicleClasses(),
      this.catalog.activeZones(),
    ]);

    return {
      vehicleClasses,
      zones,
      extras: this.catalog.extras(),
      rentalExtras: this.catalog.rentalExtras(),
    };
  }

  @Get('vehicle-classes')
  vehicleClasses() {
    return this.catalog.vehicleClasses();
  }

  @Get('zones')
  zones() {
    return this.catalog.activeZones();
  }

  @Get('fares')
  @ApiOperation({
    summary: 'Published airport price list',
    description:
      'Every city zone priced from the airport for each vehicle class, run through the same ' +
      'pure engine the quote endpoint uses — the homepage and the booking cannot disagree.',
  })
  fares() {
    return this.catalog.airportFares();
  }
}
