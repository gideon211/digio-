import { Controller, Get, Inject, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import {
  coordinatesSchema,
  placeSearchSchema,
  type CoordinatesInput,
  type PlaceSearchInput,
} from './locations.dto';
import { LocationsService } from './locations.service';

@ApiTags('locations')
@Controller('locations')
export class LocationsController {
  constructor(@Inject(LocationsService) private readonly locations: LocationsService) {}

  @Get('search')
  @ApiOperation({
    summary: 'Search places worldwide',
    description:
      'OpenStreetMap data through Photon, proxied so the provider can be swapped without ' +
      'touching the booking flow. Results carry a kind so airports can be offered as a chip.',
  })
  async search(@Query(new ZodValidationPipe(placeSearchSchema)) query: PlaceSearchInput) {
    return { places: await this.locations.search(query) };
  }

  @Get('resolve')
  @ApiOperation({
    summary: 'Nearest pricing zone for a point',
    description:
      'PostGIS KNN against the zone centroids. Returns how far the point is from the zone so ' +
      'the client can refuse anything outside the service area instead of guessing.',
  })
  resolve(@Query(new ZodValidationPipe(coordinatesSchema)) query: CoordinatesInput) {
    return this.locations.resolveZone(query);
  }

  @Get('locate')
  @ApiOperation({
    summary: 'Reverse-geocode a point and resolve its zone in one call',
    description: 'What "use my location" calls: coordinates in, readable address plus zone out.',
  })
  async locate(@Query(new ZodValidationPipe(coordinatesSchema)) query: CoordinatesInput) {
    const { place, zoneMatch } = await this.locations.locate(query);
    return { place, ...zoneMatch };
  }
}
