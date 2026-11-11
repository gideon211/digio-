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

    return { vehicleClasses, zones, extras: this.catalog.extras() };
  }

  @Get('vehicle-classes')
  vehicleClasses() {
    return this.catalog.vehicleClasses();
  }

  @Get('zones')
  zones() {
    return this.catalog.activeZones();
  }
}
