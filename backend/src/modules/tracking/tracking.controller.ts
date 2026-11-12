import { Body, Controller, Get, Inject, type MessageEvent, Param, Post, Query, Sse } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { map, type Observable, switchMap, takeWhile, timer } from 'rxjs';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { bookingRefSchema } from '../bookings/bookings.dto';
import {
  type AssignTripInput,
  assignTripSchema,
  type DriverPingInput,
  driverPingSchema,
  type NearbyQueryInput,
  nearbyQuerySchema,
} from './tracking.dto';
import { isLiveTrackingStatus, TrackingService } from './tracking.service';

const STREAM_INTERVAL_MS = 2000;

@ApiTags('tracking')
@Controller('tracking')
export class TrackingController {
  constructor(@Inject(TrackingService) private readonly tracking: TrackingService) {}

  @Post('ping')
  @ApiOperation({
    summary: 'Record a driver GPS ping',
    description:
      'Upserts the driver’s latest position (one row per driver). The simulator posts the ' +
      'equivalent internally; a real driver app would call this.',
  })
  async ping(@Body(new ZodValidationPipe(driverPingSchema)) body: DriverPingInput) {
    await this.tracking.driverPing(body.driverId, body);
    return { status: 'ok' };
  }

  @Get('nearby')
  @ApiOperation({
    summary: 'Available drivers near a point',
    description:
      'PostGIS ST_DWithin/ST_Distance over driver_locations — the “where is the nearest car” ' +
      'query. Only drivers whose status is available are considered.',
  })
  async nearby(@Query(new ZodValidationPipe(nearbyQuerySchema)) query: NearbyQueryInput) {
    const drivers = await this.tracking.nearbyDrivers(
      query.lat,
      query.lng,
      query.radiusMetres,
    );
    return { drivers };
  }

  @Post(':ref/assign')
  @ApiOperation({
    summary: 'Assign a driver to a booking',
    description:
      'Sets the booking to assigned, fetches the driving route (driver → pick-up → drop-off) ' +
      'from OSRM — falling back to a straight line when offline — stores it as trip positions ' +
      'and seeds the driver at the route start.',
  })
  assign(
    @Param('ref', new ZodValidationPipe(bookingRefSchema)) ref: string,
    @Body(new ZodValidationPipe(assignTripSchema)) body: AssignTripInput,
  ) {
    return this.tracking.assignTrip(ref, body.driverId);
  }

  @Get(':ref')
  @ApiOperation({ summary: 'Live tracking payload for a booking' })
  get(@Param('ref', new ZodValidationPipe(bookingRefSchema)) ref: string) {
    return this.tracking.currentView(ref);
  }

  @Get(':ref/stream')
  @Sse()
  @ApiOperation({
    summary: 'Server-sent tracking events',
    description:
      'Emits event `position` with the tracking payload every 2 seconds while the booking can ' +
      'still change, then closes the stream once the trip is completed or cancelled.',
  })
  async stream(
    @Param('ref', new ZodValidationPipe(bookingRefSchema)) ref: string,
  ): Promise<Observable<MessageEvent>> {
    // Resolve the booking before any SSE header is written, so an unknown ref
    // is a real 404 rather than an empty stream.
    await this.tracking.assertExists(ref);

    return timer(0, STREAM_INTERVAL_MS).pipe(
      switchMap(() => this.tracking.currentView(ref)),
      // Inclusive: the terminal payload is the last event, then the stream ends.
      takeWhile((view) => isLiveTrackingStatus(view.status), true),
      map((view): MessageEvent => ({ type: 'position', data: view })),
    );
  }
}
