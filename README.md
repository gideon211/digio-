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
- Server-owned pricing: zone pair × class multiplier + extras − promo, 30% deposit
- Quotes with a 15-minute TTL, burned atomically when a booking is created
- Booking references (`DG-XXXXXX`), public read and cancel
- Double-booking prevention enforced by a Postgres exclusion constraint
- Marketing + booking screens wired to the live API

## Not built yet

Payments (Paystack), WhatsApp notifications, phone OTP auth, self-drive rental
inventory, ops console, driver app.

## Rules the codebase enforces

1. Money is an integer number of pesewas. Formatting happens at the edge only.
2. The client never sends a price — only a quote token.
3. Pricing is a pure function; it is never computed in a controller or the browser.
4. Duplicate submissions cannot create duplicate bookings.
5. Availability conflicts are rejected by the database, not by an `if` statement.
