# Digio API

Booking API for Digio: chauffeur transfers, chauffeur day hire and self-drive rentals.
Ghana-first — GHS pricing, mobile money, WhatsApp confirmations.

## Status

Working vertical slice: **catalog → quote → booking**. Payments, dispatch and rentals are next.

```
GET  /v1/health              liveness
GET  /v1/health/ready        Postgres + PostGIS check
GET  /v1/catalog             classes, zones, extras
POST /v1/quotes/chauffeur    price a transfer (server-owned)
GET  /v1/quotes/:token       re-read a live quote
POST /v1/bookings            consume a quote, create booking
GET  /v1/bookings/:ref       read booking
POST /v1/bookings/:ref/cancel
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

## Layout

```
src/
  config/        env contract (fails fast on boot)
  common/        money, refs, pipes, error envelope
  db/            schema, migrations, seed, database module
  modules/
    health/
    catalog/     zones, vehicle classes, extras
    pricing/     pure quote engine + unit tests
    quotes/      quote lifecycle and persistence
    bookings/    quote → booking, cancel
  jobs/          BullMQ processors (next)
  integrations/  paystack, whatsapp, flights, osrm (next)
```

## Conventions

- Prices in responses are named `*Pesewas` and are integers.
- Errors are `{ error: { code, message, details? }, requestId }`. Test `code`, not prose.
- Timestamps are ISO 8601 UTC; business logic is pinned to `Africa/Accra`.
- Phone numbers are stored E.164 (`+233...`) via `normaliseGhanaPhone()`.

## Next up

1. `payments/` — Paystack initialize, HMAC-verified webhook, idempotent ledger,
   30% deposit → `deposit_paid`, refunds.
2. `notifications/` — WhatsApp Cloud API template for booking confirmation.
3. `rentals/` — date-range availability using the exclusion constraint.
4. `auth/` — phone OTP, JWT rotation, admin TOTP + RBAC.
5. BullMQ workers — quote expiry sweep, flight tracking, reminders.

## Notes

- Dev uses `tsx`, which does not emit decorator metadata. Dependencies injected by
  class are therefore annotated with `@Inject(...)` explicitly. The production build
  (`tsc`) also emits metadata, so both paths resolve.
- Docker maps Postgres to **5434** and Redis to **6380** to avoid clashing with
  other local stacks.
