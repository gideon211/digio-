# Digio API

Booking API for Digio: chauffeur transfers, chauffeur day hire and self-drive rentals.
Ghana-first — GHS pricing, mobile money, WhatsApp confirmations.

## Status

Working vertical slice: **search → price → book → deposit → confirmation**, for
transfers and for rentals.

```
GET  /v1/health              liveness
GET  /v1/health/ready        Postgres + PostGIS check

GET  /v1/catalog             classes, zones, extras, rental extras
GET  /v1/catalog/zones       active zones with coordinates

GET  /v1/locations/search    OSM place search (Photon, proxied, Accra-biased)
GET  /v1/locations/resolve   nearest pricing zone for a point (PostGIS KNN)
GET  /v1/locations/locate    reverse geocode + zone in one call

POST /v1/quotes/chauffeur    price a transfer (server-owned)
POST /v1/quotes/transfer-compare   price every class on a route, writes nothing
POST /v1/quotes/rental       price a self-drive rental or chauffeur day hire
GET  /v1/quotes/:token       re-read a live quote

GET  /v1/rentals/classes     availability + day rates for a date range
GET  /v1/rentals/availability   vehicles free for a date range

POST /v1/bookings            consume a quote, create booking
GET  /v1/bookings/:ref       read booking
POST /v1/bookings/:ref/cancel

POST /v1/tracking/ping                 a driver posts their position
GET  /v1/tracking/nearby               cars within a radius (PostGIS)
POST /v1/tracking/:ref/assign          assign a driver, store the route
GET  /v1/tracking/:ref                 current position, ETA and phase
GET  /v1/tracking/:ref/stream          server-sent events, closes on completion
POST /v1/enquiries                     corporate, events, jets and yachts

POST /v1/payments/initialize start (or reuse) a deposit checkout
GET  /v1/payments/:reference poll a payment
GET  /v1/payments/booking/:bookingRef
POST /v1/payments/webhook/paystack   HMAC-verified, idempotent
```

OpenAPI UI: <http://localhost:4000/docs>

## Stack

| Layer | Choice |
| --- | --- |
| Runtime | Node 24, TypeScript (strict), CommonJS build |
| Framework | NestJS 12 on Fastify |
| Validation | Zod + `ZodValidationPipe` (no DTO classes) |
| ORM | Drizzle + `drizzle-kit` migrations |
| Database | Postgres 16 + PostGIS + `btree_gist` |
| Queue | BullMQ + Redis (wired next) |
| Money | integer pesewas, never floats |
| Docs | `@nestjs/swagger` at `/docs` |

## Quick start

```bash
cp .env.example .env
docker compose up -d postgres redis
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Then:

```bash
curl -s localhost:4000/v1/health/ready
curl -s localhost:4000/v1/catalog/vehicle-classes
```

## Architecture rules

1. **The server owns price and availability.** Clients send intent and receive a
   quote token. `POST /bookings` accepts only that token, never a price.
2. **Pricing is pure.** `src/modules/pricing/quote-engine.ts` has no I/O, no clock
   and no dependency injection, so it can be tested exhaustively.
3. **Quotes expire.** Default 15 minutes (`QUOTE_TTL_MINUTES`). Expired or used
   quotes cannot become bookings.
4. **Duplicate submissions are safe.** The quote is burned inside the booking
   transaction; a second request gets `409 QUOTE_ALREADY_USED`.
5. **Double-booking is impossible at the storage layer.** `rental_periods` carries
   `EXCLUDE USING gist (vehicle_id WITH =, period WITH &&)`.
6. **Money is an integer number of pesewas.** Format only at the edge with
   `formatGhs()`.

## Payments

```
POST /payments/initialize
  amount  = deposit_due − paid          (server-owned, never client input)
  reuse   = an open checkout < 30 min old for the same amount
  create  = payments row (initialized) → Paystack → (pending, authorization_url)

POST /payments/webhook/paystack
  verify  = HMAC-SHA512 of the raw body, compared with timingSafeEqual
  lock    = SELECT … FOR UPDATE on the payment row
  if paid → no-op                       (replay-safe)
  else    → payment succeeded, booking paid += amount, status → deposit_paid
            notification outbox rows written in the same transaction
```

- **No secret key?** In development the API exposes a simulated checkout at
  `/v1/payments/simulate/:reference` that marks the deposit paid locally. It is
  unreachable when `NODE_ENV=production`.
- **Amount mismatch** is logged and ignored, never credited.
- **Unknown reference** returns 200 so Paystack stops retrying something that
  cannot succeed.

## Notifications

Messages are written to `notification_outbox` inside the payment transaction, so
a crash cannot lose a confirmation. `NotificationsService` drains the table every
15 seconds using `FOR UPDATE SKIP LOCKED`, which is safe across API instances.

- WhatsApp is attempted immediately; the SMS row is delayed 60 seconds and
  cancelled the moment WhatsApp is delivered.
- Failed WhatsApp after 5 attempts releases the SMS fallback immediately.
- Idempotency key: `(booking_id, event, channel)` — a replayed webhook cannot
  enqueue a second message.
- Without provider credentials, messages are rendered into the log
  (`[whatsapp:log]`, `[sms:log]`) so the pipeline is testable offline.

### Before this can send real messages

| Requirement | Why |
| --- | --- |
| NCA-registered `DIGIO` SMS sender ID | Unregistered IDs get filtered in Ghana |
| Meta-approved WhatsApp utility template | Free-form text is rejected outside a 24-hour window |
| `APP_URL` pointing at the public site | Manage links inside messages must resolve |

Set `WHATSAPP_TEMPLATE_NAME` after approval; until then the provider sends
free-form text, which only works inside an open service window.

## Layout

```
src/
  config/        env contract (fails fast on boot)
  common/        money, refs, pipes, pg error codes, error envelope
  db/            schema, migrations, seed, database module
  modules/
    health/
    catalog/     zones, vehicle classes, extras
    locations/   OSM search, reverse geocode, PostGIS nearest zone
    pricing/     pure quote engine + unit tests
    quotes/      quote lifecycle, persistence, comparison pricing
    rentals/     date-range availability on the exclusion constraint
    bookings/    quote → booking, cancel (frees the car)
    payments/    Paystack initialize, webhook, idempotent ledger
    notifications/  transactional outbox, WhatsApp + SMS
    tracking/    driver positions, route playback, SSE stream
    enquiries/   corporate, events, jets and yachts (write-only)
  jobs/          BullMQ processors (next)
  integrations/  paystack, whatsapp, flights (next)
```

## Rentals

A rental day is a calendar day and the window is half-open `[from, to)` — the
same reading is used by pricing, by the availability query and by `daterange`,
so the three can never disagree.

- `GET /rentals/classes?fromDate=&toDate=` returns every class with its day rate,
  its security hold and how many cars are free for those dates.
- `POST /quotes/rental` **pins a specific vehicle** rather than a class: the rate
  comes from that car and the reservation is made against it.
- `POST /bookings` inserts `rental_periods` in the same transaction. If the car
  went in the meantime, Postgres raises `23P01` and the API answers
  `409 VEHICLE_UNAVAILABLE` — the quote is rolled back, not consumed.
- `POST /bookings/:ref/cancel` deletes the period row, returning the car to the
  fleet immediately.

## Locations

`GET /locations/search?q=&lat=&lng=` proxies Photon (OpenStreetMap) so the
provider can be swapped without touching the booking flow, and biases results
toward Accra — without a bias Photon ranks by global popularity.

`GET /locations/locate?lat=&lng=` reverse-geocodes and resolves the pricing zone
in one round trip: `order by centroid <-> point` over `zones.centroid`, which is
a `geography(Point,4326)` column with a GiST index. The response carries the
distance so the client can refuse anything past the 40 km service radius.

## Tracking

`driver_locations` holds one row per driver with a real
`geography(Point,4326)` column and a GiST index, so `GET /tracking/nearby` is
one `ST_DWithin` rather than a scan. Positions arrive by `POST /tracking/ping`.

A trip gets its geometry from OSRM when a driver is assigned. If OSRM is
unreachable the route degrades to a straight line and the trip still tracks —
a network outage must not strand a customer. Playback advances along the stored
polyline and writes `trip_positions`; the phase moves `to_pickup` → `arrived` →
`on_trip` → `completed` from distance, not from a timer.

`GET /tracking/:ref/stream` is server-sent events, one payload every two
seconds, which emits the terminal state once and closes the connection. An SSE
stream that never closes is a leak, so the close is part of the contract.

Outside production a simulator drives the same code path, so the whole flow can
be demonstrated before the driver app exists. Set `TRACKING_SIMULATION=false` to
turn it off; it defaults to off in production.

## Conventions

- Prices in responses are named `*Pesewas` and are integers.
- Errors are `{ error: { code, message, details? }, requestId }`. Test `code`, not prose.
- Timestamps are ISO 8601 UTC; business logic is pinned to `Africa/Accra`.
- Phone numbers are stored E.164 (`+233...`) via `normaliseGhanaPhone()`.

## Next up

1. ~~`payments/` — Paystack initialize, HMAC-verified webhook, idempotent ledger,
   30% deposit → `deposit_paid`.~~ Done.
2. ~~`notifications/` — SMS + WhatsApp confirmation through a transactional outbox.~~
   Done (delivery receipts and quiet hours still open).
3. ~~`rentals/` — date-range availability using the exclusion constraint.~~ Done.
4. ~~`locations/` — OSM search, reverse geocode, PostGIS nearest zone.~~ Done.
5. ~~`tracking/` — driver positions, OSRM route, SSE stream, simulator.~~ Done
   (driver app still needed for real positions).
6. `auth/` — phone OTP, JWT rotation, admin TOTP + RBAC.
7. BullMQ workers — quote expiry sweep, flight tracking, reminders.
8. Refunds — cancellation policy table, Paystack refund API, ledger reversal.

## Notes

- Dev uses `tsx`, which does not emit decorator metadata. Dependencies injected by
  class are therefore annotated with `@Inject(...)` explicitly. The production build
  (`tsc`) also emits metadata, so both paths resolve.
- Docker maps Postgres to **5434** and Redis to **6380** to avoid clashing with
  other local stacks.
