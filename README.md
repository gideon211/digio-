# Digio

Ghana-first luxury mobility platform: airport transfers, chauffeur hire, self-drive
rentals and concierge enquiries (jets, yachts, corporate).

## Layout

```
Digio/
├── backend/     NestJS API — pricing, quotes, bookings (Postgres + PostGIS)
├── frontend/    Next.js 16 customer app (PWA-first, Tailwind v4)
├── docs/        architecture notes and decisions
└── infra/       self-hosted routing and deployment notes
```

## Run it

```bash
# 1. database + redis
cd backend
docker compose up -d postgres redis

# 2. api
cp .env.example .env
npm install
npm run db:migrate
npm run db:seed
npm run dev            # http://localhost:4000/v1  ·  docs at /docs

# 3. web
cd ../frontend
cp .env.local.example .env.local
npm install
npm run dev            # http://localhost:3000
```

Postgres is mapped to **5434** and Redis to **6380** so this repo can run alongside
other local stacks.

## What works today

- Catalog: 11 Accra zones, 3 vehicle classes, 5 seeded vehicles, 330 zone-pair prices
- Server-owned pricing: zone pair × class multiplier + extras − promo for
  transfers, day rate × days + delivery + extras for rentals, 30% deposit
- Address search over OpenStreetMap, reverse geocoding, and PostGIS nearest-zone
  resolution with a 40 km service radius
- Comparison pricing: all three classes priced on a route in one call, without
  burning a quote
- Quotes with a 15-minute TTL, burned atomically when a booking is created
- Self-drive and chauffeur-day-hire rentals; double-booking prevented by a Postgres
  exclusion constraint, and cancelling frees the car again
- Booking references (`DG-XXXXXX`), public read and cancel
- Deposits by mobile money or card through Paystack, with an HMAC-verified,
  replay-safe webhook and a simulated checkout for local development
- SMS + WhatsApp confirmation through a transactional outbox, with SMS as a
  fallback only when WhatsApp does not land
- Live trip tracking: driver positions on a PostGIS geography column, a route
  from OSRM with an offline fallback, and an SSE stream that closes itself when
  the trip finishes
- A homepage built to sell: a branded route motif in the hero with a live
  airport fare board, the published fare list, a fleet band with both rates,
  how it works, a live-tracking preview, enquiries, FAQ and a full footer —
  responsive from 390 px to 1280 px

## Not built yet

Refunds, phone OTP auth, dispatch console, driver app. The tracking simulator
moves cars for demo purposes until the driver app posts real positions.

## Rules the codebase enforces

1. Money is an integer number of pesewas. Formatting happens at the edge only.
2. The client never sends a price — only a quote token.
3. Pricing is a pure function; it is never computed in a controller or the browser.
4. Duplicate submissions cannot create duplicate bookings.
5. Availability conflicts are rejected by the database, not by an `if` statement.
6. A zone is resolved from coordinates on the server, never chosen by the client.
