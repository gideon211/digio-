# Digio API

Booking API for Digio: chauffeur transfers, chauffeur day hire and self-drive rentals.
Ghana-first — GHS pricing, mobile money, WhatsApp confirmations.

## Status

Working vertical slice: **catalog → quote → booking → deposit → confirmation**.

```
GET  /v1/health              liveness
GET  /v1/health/ready        Postgres + PostGIS check
GET  /v1/catalog             classes, zones, extras
POST /v1/quotes/chauffeur    price a transfer (server-owned)
GET  /v1/quotes/:token       re-read a live quote
POST /v1/bookings            consume a quote, create booking
GET  /v1/bookings/:ref       read booking
POST /v1/bookings/:ref/cancel
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

1. ~~`payments/` — Paystack initialize, HMAC-verified webhook, idempotent ledger,
   30% deposit → `deposit_paid`.~~ Done.
2. ~~`notifications/` — SMS + WhatsApp confirmation through a transactional outbox.~~
   Done (delivery receipts and quiet hours still open).
3. `rentals/` — date-range availability using the exclusion constraint.
4. `auth/` — phone OTP, JWT rotation, admin TOTP + RBAC.
5. BullMQ workers — quote expiry sweep, flight tracking, reminders.
6. Refunds — cancellation policy table, Paystack refund API, ledger reversal.

## Notes

- Dev uses `tsx`, which does not emit decorator metadata. Dependencies injected by
  class are therefore annotated with `@Inject(...)` explicitly. The production build
  (`tsc`) also emits metadata, so both paths resolve.
- Docker maps Postgres to **5434** and Redis to **6380** to avoid clashing with
  other local stacks.
