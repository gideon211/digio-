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

## Availability

Self-drive rentals reserve `rental_periods (vehicle_id, daterange)`. The migration adds:

```sql
EXCLUDE USING gist (vehicle_id WITH =, period WITH &&)
```

Overlapping reservations are rejected by Postgres. Application code can only ever
handle the error, never cause the conflict.

## Data model notes

- `zone_pairs` is directional: airport → zone and zone → airport can be priced
  differently.
- `quotes.payload` freezes the request plus the resolved rate context, so a quote can
  be explained after the price table changes.
- `payments.provider_ref` is unique — the webhook idempotency key.
- Documents carry `expires_at` for licence and roadworthy tracking.

## Decisions

| Decision | Why |
| --- | --- |
| NestJS on Fastify | Three clients (web, ops, Expo) plus webhooks; REST/OpenAPI fits better than tRPC |
| Zod instead of DTO classes | Schemas shared with the frontend, one source of truth |
| Explicit `@Inject()` | `tsx` does not emit decorator metadata in dev; the `tsc` build also works |
| PostGIS for zones only | Spatial queries are for zones and geofences, not driver proximity |
| MapLibre + OSRM | No per-load map billing; routing costs stay flat as bookings grow |

## Open questions

- Traffic-aware ETA: TomTom or Google Directions at quote time (OSRM alone will be
  optimistic in Accra traffic).
- Rental day definition: 12-hour day with overtime tiers, per market convention.
- Cancellation policy windows, needed before payment go-live.
