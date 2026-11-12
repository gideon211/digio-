# Architecture

## Shape

A modular monolith. One deployable API, split by domain inside `backend/src/modules`.
The seams exist so payments, dispatch or notifications can be extracted later without
a rewrite.

```
controller → service → repository (Drizzle) → Postgres
```

Controllers handle HTTP and validation. Services own business rules and state
transitions. Repositories only speak SQL. Integrations sit behind narrow ports so
tests can use fakes.

## Money

- Stored and computed as **integer pesewas**.
- `formatGhs()` is the only place division by 100 happens.
- Deposits settle to the nearest cedi.
- Currency is GHS, single-currency for now; `bookings.currency` is present for later.

## Pricing

`modules/pricing/quote-engine.ts` is pure: no DB, no HTTP, no clock.

- Transfer: `round(base zone-pair price × class multiplier, GH₵5) + extras`
- Rental: `daily rate × days + delivery + extras`
- Discounts stack additively, capped at 25% by default; each promo may carry its own cap
- Deposit: 30% of total, minimum GH₵1
- Security deposit for rentals is reported separately and never enters the total

## Locations

Address search and "use my location" both resolve to a **pricing zone** before
anything is priced. The client never picks a zone itself.

```
GET /locations/search?q=&lat=&lng=
  → Photon (OpenStreetMap) proxied server-side
  → label + coordinates + kind
  → results inside the service area floated to the top

GET /locations/locate?lat=&lng=          (what GPS calls)
  → Photon reverse geocode        → readable address
  → PostGIS nearest zone          → slug it prices as
  → distance                      → client refuses anything beyond 40 km
```

- Photon is proxied rather than called from the browser so the provider can be
  swapped (Google, Mapbox) without touching the booking flow, and so results can
  be cached and biased toward Accra. Without a bias Photon ranks by global
  popularity, which puts a village in Côte d'Ivoire above Kotoka.
- Zone resolution is `order by centroid <-> point` on the `zones.centroid`
  geography column, backed by a GiST index. The same table drives the form's
  dropdown and a pin dropped on a map, so they cannot disagree.
- If the search service is unreachable the client falls back to the 11 zones it
  already holds in memory: booking must not depend on a third party being up.

## Quote → booking

```
POST /quotes/chauffeur
  resolve class, zones, zone pair, promo
  price via pure engine
  persist quote { token, payload, breakdown, totals, expires_at }

POST /bookings
  BEGIN
    UPDATE quotes SET consumed_at = now()
      WHERE token = $1 AND consumed_at IS NULL   -- atomic claim
    UPSERT customer by phone
    INSERT booking (pending)
  COMMIT
```

A second submission gets `409 QUOTE_ALREADY_USED`. An expired quote gets
`410 QUOTE_EXPIRED`. The client cannot influence the amount.

`POST /quotes/transfer-compare` prices **every** class on a route in one call and
writes nothing. The "choose your car" step needs all three prices at once, but
issuing three tokens would reserve nothing and burn three rows; this runs the
same pure engine with the same inputs the issued quote will use, so the number
on screen and the number on the quote never disagree.

## Payments

```
initialize → payments row (initialized)
          → Paystack checkout
          → (pending, authorization_url)

webhook charge.success
  verify HMAC-SHA512 over the raw body
  BEGIN
    SELECT payment FOR UPDATE
    if status = succeeded → return            -- replay-safe
    amount ≠ expected     → log, do not credit
    UPDATE payment  SET succeeded, paid_at, raw
    UPDATE booking  SET paid += amount, status = deposit_paid
    INSERT notification_outbox (whatsapp, sms) -- same transaction
  COMMIT
```

Two properties matter more than the code:

1. **The ledger row is the lock.** A payment can only transition to `succeeded`
   once, so the booking's `paid_pesewas` can never be credited twice, no matter
   how many times Paystack retries.
2. **The amount is re-derived server-side.** A webhook carries an amount, but it
   is only used to *check* what was expected, never to set it.

Refunds and partial balances are deliberately absent: they need a cancellation
policy table before they can be coded honestly.

## Notifications

The outbox is the queue. Rows are written inside the payment transaction, so
"deposit paid but no message" is not a reachable state.

```
notification_outbox (booking_id, event, channel) UNIQUE
  → dispatcher claims with FOR UPDATE SKIP LOCKED
  → WhatsApp template
  → on success: cancel the sibling SMS row
  → on permanent failure: release the sibling SMS row
```

- SMS is a fallback, not a duplicate: delayed 60 seconds, cancelled when
  WhatsApp lands.
- Retries use exponential backoff, five attempts, then `failed`.
- Without credentials the providers log the exact rendered message, so the whole
  path is testable locally.

## Availability

Self-drive rentals reserve `rental_periods (vehicle_id, daterange)`. The migration adds:

```sql
EXCLUDE USING gist (vehicle_id WITH =, period WITH &&)
```

Overlapping reservations are rejected by Postgres. Application code can only ever
handle the error, never cause the conflict.

## Tracking

```
POST /tracking/ping                driver position → driver_locations (upsert)
POST /tracking/:ref/assign         assign driver → OSRM route → trip_positions
GET  /tracking/nearby              ST_DWithin over driver_locations
GET  /tracking/:ref                phase, position, ETA, route
GET  /tracking/:ref/stream         SSE every 2s, closes on the terminal state
```

- Positions live in `driver_locations` as `geography(Point,4326)` with a GiST
  index — "nearest available car" is one index lookup, not a table scan.
- The route comes from OSRM when the trip is assigned. If OSRM is unreachable
  the geometry falls back to a straight line between the two points: a network
  outage must not stop a customer from being tracked.
- Playback advances along the stored polyline and appends `trip_positions`.
  Phase is derived from distance travelled (`to_pickup` → `arrived` → `on_trip`
  → `completed`), never from a timer, so a traffic jam cannot complete a trip
  early.
- The stream emits every two seconds, then emits the terminal payload once and
  closes. The close is part of the contract — an SSE connection that never ends
  is a leak.
- A simulator drives the same code path outside production (`TRACKING_SIMULATION`,
  off in production) so the flow works before the driver app exists. Progress is
  derived from the last trace row, so several API instances ticking at once
  cannot double-speed the car.

## Data model notes

- `zone_pairs` is directional: airport → zone and zone → airport can be priced
  differently.
- `quotes.payload` freezes the request plus the resolved rate context, so a quote can
  be explained after the price table changes.
- `payments.provider_ref` is unique — the webhook idempotency key.
- Documents carry `expires_at` for licence and roadworthy tracking.

## Frontend

Next.js 16 (App Router) + Tailwind v4. One customer app, mobile-first, with the
container widening rather than the design changing.

**Design tokens live in `app/globals.css`.** Nothing hard-codes a colour, radius
or type size in a component.

| Rule | Value |
| --- | --- |
| Conversion colour | gold `#b8841f` — one primary button colour, nothing else competes |
| Surfaces | forest `#0f3d2e` for dark bands, white for cards, cream `#eef1ec` for the page |
| Interactive shape | pill `999px` on every button, chip and tab |
| Card shape | `16px`, flat by default — shadow only on the request form and dropdowns |
| Spacing | 4px scale: 4 / 6 / 8 / 12 / 16 / 20 / 24 / 32 |
| Type | Bricolage Grotesque 700 for display, DM Sans 400/500 for everything else |
| Voice | sentence case headlines, no letter-spacing tricks |

Layout is two containers: `.app-shell` (max 1120px, shared by header, page and
footer so gutters line up) and `.stack` (max 560px) which narrows transactional
pages so a form never stretches across a desktop. Grids run 1-up on a phone and
3-up from `md`.

Pages:

- `/` — hero band with the request form, services, fleet, how it works, a
  polarity-flipped promo band, footer.
- `/book` — three steps: trip → choose your car (server-priced for all three
  classes) → confirm and pay.
- `/rent` — two steps: car (dates, class, delivery, extras) → confirm.
- `/b/[ref]` — status, details, security hold, payment history, resume or cancel.
- `/book/return` — polls the payment until Paystack's webhook lands.

The client never computes a price. Every figure on screen is a number the API
returned.

## Decisions

| Decision | Why |
| --- | --- |
| NestJS on Fastify | Three clients (web, ops, Expo) plus webhooks; REST/OpenAPI fits better than tRPC |
| Zod instead of DTO classes | Schemas shared with the frontend, one source of truth |
| Explicit `@Inject()` | `tsx` does not emit decorator metadata in dev; the `tsc` build also works |
| PostGIS for zones and driver positions | One `geography(Point,4326)` column with a GiST index answers both "which zone is this" and "which car is nearest" |
| OSRM for routes, straight line as fallback | No per-load map billing; routing costs stay flat as bookings grow, and an outage degrades instead of failing |
| Photon proxied through our API | The provider stays swappable and results can be biased toward Accra and cached |
| One conversion colour on the web | Gold on every primary action; forest and white carry everything else, so the eye always knows where to go |

## Open questions

- Traffic-aware ETA: TomTom or Google Directions at quote time (OSRM alone will be
  optimistic in Accra traffic).
- Rental day definition: 12-hour day with overtime tiers, per market convention.
- Cancellation policy windows, needed before payment go-live.
