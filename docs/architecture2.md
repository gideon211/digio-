# Architecture — the marketplace

This document describes the platform Digio is becoming. It sits beside
`architecture.md`, which describes the vertical slice that exists today. That
one is accurate about the code as written; this one is about where the code
has to go.

Read them as "now" and "next". Where they disagree about a rule, the rules in
`architecture.md` still hold — this document adds to them, it does not
replace them.

---

## The business

Digio is a **two-sided marketplace for chauffeur and self-drive ground
transport**, live in Accra first and opening city by city.

Two sides:

- **Supply** — independent drivers and local fleet operators who own or lease
  their own cars. They set their own hours and decide which jobs to take.
- **Demand** — riders booking a single trip, corporate accounts on monthly
  invoicing, and event and concierge clients.

What makes it *Digio* rather than a ride-hailing clone:

1. **The price is published and fixed.** Zone-pair fare × vehicle class,
   visible on the homepage before you book. Tolls included. No surge, ever.
2. **The cars are vetted.** Every vehicle is inspected and insured against one
   standard before it can be offered, whoever owns it.
3. **The standard travels.** New cities open with local fleets held to the
   same inspection, insurance and pricing standard. One standard, not a
   franchise.

The fixed price is not a luxury positioning — it is the fix for the problem
that stops ride-hailing working in Accra. A metered fare cannot be quoted
without surge pricing, and surge is what makes airport transfers unaffordable
and untrustworthy. So the platform pre-computes the fare per zone pair and
class, publishes it, and honours it.

That decision has a hard consequence, and it is the central design problem of
this document: **the platform loses surge as a supply-side lever.** Section
"Utilisation without surge" is how that gets solved.

### Where the money comes from

| Product | Price basis | Notes |
| --- | --- | --- |
| Airport / city transfer | Zone-pair fare × class multiplier | Per trip |
| Chauffeur hire | Day rate × days | Chauffeur day hire, same cars |
| Self-drive rental | Vehicle day rate × days | Plus a refundable security hold, never part of the price |
| Corporate account | Monthly invoice, named drivers, one contact | Enquiry today; invoiced later |
| Events, long-term hire | Quoted by a person | Matched fleet for the day |
| Jets, yachts | Quoted by a person | Terminal-side pickup, marina transfer |
| New city partnerships | Supply-side recruitment | Fleet owners who meet the standard |

---

## Where the code is today

Honest gap analysis. Every row here is a thing that has to exist for this to
be a marketplace, and the "today" column is verified against the code, not
against the README.

| Marketplace primitive | Today | Gap |
| --- | --- | --- |
| Server-owned price, no surge | Strong — the quote engine is pure | — |
| Supply-side organisations | `vehicles` and `drivers` have no owner | Operators do not exist |
| Driver availability | `driver_status` enum exists | Nothing ever writes `available` / `off_duty` |
| Offer and accept | `nearbyDrivers` exists | Nothing calls it; assign is manual |
| Driver identity and auth | Nothing | No `auth/` module |
| Commission, earnings, payout | Nothing | No take rate anywhere in the code |
| Balance collected by the platform | `payment_kind` has `balance` | Nothing writes it; 70% is cash at handover |
| Double-entry ledger | `payments` is a one-sided ledger | No commission, no payout, no reconciliation |
| Multi-city | No `city` anywhere; `currency` is a `'GHS'` literal | Cities, zones and money are all single-market |
| Rider rates driver | `driver.rating` is seed data | No rating flow |
| Ops surface | Two routes, no auth, hidden from Swagger | No dispatch console |
| Queue | `bullmq` and `ioredis` in `package.json` | Imported nowhere |
| Rider onboarding | `documents` table exists | Never written to |
| Flights, waiting time, reminders | None | Promised on the homepage, not implemented |

`src/jobs/` and `src/integrations/` appear in the backend README's layout
section but do not exist on disk.

### Two live defects, to fix before anything else

Both are on the pricing engine and both are revenue leaks on a live system.

**1. The client chooses its own membership discount.** `membershipPercent` is
accepted from the request body in `quotes.dto.ts` and `rentals.dto.ts`, and
applied as a discount. Verified against the running API: a quote for
Kotoka → Cantonments returns GH₵60, and the identical request with
`"membershipPercent": 25` returns GH₵45. Any caller can claim the top tier.

The discount belongs to the customer record, not to the request. It should be
read from `customers.membership_percent` once there is an authenticated
customer to read it from. Until then it should not be accepted from the
client at all.

**2. A promo's minimum spend is checked against the wrong number.**
`resolvePromo` is called with the zone-pair base price rather than the
subtotal. Both directions were confirmed against the running API with a
throwaway promo:

- *False rejection* — Kotoka → Airport City, Premium SUV, minimum GH₵60. The
  real subtotal is GH₵70 (base GH₵45 × 1.6, on the ladder) and the promo
  applies, but the base price alone is GH₵45, so the code answers
  `PROMO_MINIMUM_NOT_MET`. The sedan on the same route, whose real subtotal
  is genuinely below the minimum, is rejected for the same wrong reason.
- *False acceptance* — Airport City → Labone, Executive Sedan, minimum
  GH₵75.50. The base price is GH₵76 and passes the check, but the price
  ladder rounds the real subtotal down to GH₵75, which is below the minimum.
  The promo is applied to a booking that does not qualify.

The check has to run against the number the engine actually charges, which
means the subtotal has to come out of the same arithmetic the engine uses
rather than being re-derived at the call site.

Both fixes are small and belong in the pricing module, not in a controller.

---

## Target system

```
      rider web (PWA)          ops console (web)          driver app (Expo)
             │                        │                         │
             └────────────────────────┴─────────────────────────┘
                                     │  REST + SSE
                 ┌───────────────────┴───────────────────┐
                 │        NestJS modular monolith        │
                 │                                       │
                 │  auth      dispatch    fleet          │
                 │  quotes    bookings    ledger         │
                 │  payments  payouts     tracking       │
                 │  notifications          locations     │
                 │  catalog   pricing      enquiries     │
                 └───────────────────┬───────────────────┘
                                     │
        ┌────────────────────────────┼────────────────────────────┐
     Postgres                    Redis                    External
   truth + PostGIS      presence, queue, cache        OSRM · Photon
                                                   Paystack · WhatsApp
```

**The monolith stays.** The seams are already correct — payments,
notifications and tracking are independent modules behind narrow ports,
which is exactly what the architecture doc means by "extracted later without
a rewrite". Splitting into services now buys latency and costs transactions
that must stay atomic. The quote-burn-then-book sequence, the payment ledger
and the outbox write all rely on one database transaction. That is a feature.

**Two real-time transports, not one.** SSE for the ops live board and the
rider's trip view: server to browser, one direction, already proven by the
tracking stream. Push notifications for driver offers: the driver app is
backgrounded, and a phone that cannot wake for a job is not supply.

**Postgres is the source of truth for everything that matters.** Presence and
queue state live in Redis because they are ephemeral and hot. Anything that
must survive a restart — bookings, offers, ledger, presence snapshots — is in
Postgres.

---

## Domain model

Five new tables change the shape of the business. They are worth landing
before the auth and dispatch code, because everything downstream depends on
them.

### Cities and operators

```sql
create table cities (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique,
  name              text not null,
  country_code      char(2) not null,
  currency          char(3) not null,
  timezone          text not null,
  service_radius_km integer not null default 40,
  commission_bps    integer not null default 2500,
  status            text not null default 'draft'
                    -- draft | announced | live
);

create table operators (
  id                  uuid primary key default gen_random_uuid(),
  city_id             uuid not null references cities(id),
  name                text not null,
  contact_name        text not null,
  phone               text not null,
  email               text,
  commission_bps      integer not null default 2500,
  agreement_signed_at timestamptz,
  status              text not null default 'pending'
                      -- pending | active | suspended
);

alter table vehicles add column operator_id uuid references operators(id);
alter table drivers  add column operator_id uuid references operators(id);
alter table zones    add column city_id     uuid references cities(id);
alter table zone_pairs add column city_id  uuid references cities(id);
```

An operator is a local business that puts cars on the platform: a fleet
owner, a partner company, a licensed operator in a new city. The commission
rate lives on the operator because the take rate is a commercial agreement,
not a constant. Uber's fleet-partner model is the same shape.

`city_id` on `zones` and `zone_pairs` is denormalised rather than derived
through the zone, because the fare list query and the availability query both
filter by city and a join through `zones` on every row of a pricing table is
a cost with no benefit.

### Driver presence

```sql
create table driver_presence (
  driver_id    uuid primary key references drivers(id) on delete cascade,
  status       text not null default 'off_duty',
  last_ping_at timestamptz,
  updated_at   timestamptz not null default now()
);
```

Separate from `driver_status` on `drivers`, which describes the driver's
relationship to a job, not their availability to take one. A driver is
`off_duty` while online and idle, and `available` while online and idle —
the two columns answer different questions and would drift if they shared a
row.

Presence is heartbeat-based. A driver is treated as offline when the last
ping is older than the staleness window. Nothing flips a driver offline
because a request arrived and they did not answer — that is how a driver
gets punished for a dead battery.

### Dispatch offers

```sql
create table dispatch_offers (
  id             uuid primary key default gen_random_uuid(),
  booking_id     uuid not null references bookings(id) on delete cascade,
  driver_id      uuid not null references drivers(id),
  operator_id    uuid references operators(id),
  distance_m     integer not null,
  eta_seconds    integer not null,
  status         text not null default 'offered'
                 -- offered | accepted | declined | expired | withdrawn
  offered_at     timestamptz not null default now(),
  expires_at     timestamptz not null,
  responded_at   timestamptz,
  decline_reason text
);

create unique index one_live_offer_per_booking
  on dispatch_offers (booking_id)
  where status in ('offered', 'accepted');

create unique index one_accepted_offer_per_driver
  on dispatch_offers (driver_id)
  where status = 'accepted';
```

Two partial unique indexes do the work that a transaction and a status check
would otherwise have to. The first makes it impossible for two drivers to
hold a live offer on the same booking. The second makes it impossible for one
driver to accept two jobs at once.

### The ledger

```sql
create table ledger_entries (
  id              uuid primary key default gen_random_uuid(),
  account         text not null,
  direction       text not null,      -- debit | credit
  amount_minor    integer not null,
  currency        char(3) not null,
  booking_id      uuid references bookings(id),
  driver_id       uuid references drivers(id),
  operator_id     uuid references operators(id),
  payment_id      uuid references payments(id),
  payout_id       uuid references payouts(id),
  memo            text,
  idempotency_key text not null unique,
  created_at      timestamptz not null default now()
);
```

The accounts:

| Account | Meaning |
| --- | --- |
| `rider_payable` | Money collected from riders, not yet credited to a driver |
| `driver_payable` | Money owed to drivers, not yet paid out |
| `platform_revenue` | Digio's commission |
| `promo_expense` | Discounts Digio absorbs |
| `gateway_fees` | Paystack and SMS charges |
| `cash_in_transit` | Payouts raised but not yet settled with the provider |
| `cash_settled` | Payouts confirmed by the provider |

One rider payment of GH₵100 becomes four rows:

```
debit   rider_payable     100
credit  driver_payable     70
credit  platform_revenue   25
credit  gateway_fees        5
```

A driver payout debits `driver_payable` and credits `cash_in_transit`, which
becomes `cash_settled` when the provider confirms. Commission reporting,
driver earnings, refunds and provider reconciliation all become queries over
one table, instead of five special cases that drift apart.

`idempotency_key` is what makes the ledger safe to write from a webhook that
Paystack will retry. The key is derived from the event, so a replay is a
constraint violation rather than a second credit.

`payments` stays as the **provider** record — Paystack references, raw
payloads, authorization URLs. The ledger is the **truth**. Keeping them
separate means Paystack can be replaced without rewriting the books.

### Payouts, operators, ratings

```sql
create table payouts (
  id           uuid primary key default gen_random_uuid(),
  operator_id  uuid not null references operators(id),
  period_start timestamptz not null,
  period_end   timestamptz not null,
  status       text not null default 'pending'
               -- pending | processing | paid | failed
  total_minor  integer not null,
  currency     char(3) not null,
  provider_ref text
);

create table payout_items (
  id              uuid primary key default gen_random_uuid(),
  payout_id       uuid not null references payouts(id) on delete cascade,
  driver_id       uuid not null references drivers(id),
  gross_minor     integer not null,
  commission_minor integer not null,
  net_minor       integer not null,
  status          text not null default 'pending'
);

create table trip_ratings (
  id         uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  driver_id  uuid not null references drivers(id),
  rider_id   uuid references customers(id),
  stars      integer not null check (stars between 1 and 5),
  tags       text[] not null default '{}',
  comment    text,
  created_at timestamptz not null default now(),
  unique (booking_id, driver_id)
);
```

Payouts are made per operator, not per driver. An operator holds the
commercial relationship and the contractual payout cycle, and drivers within
one operator are paid on the same schedule. This also keeps payout volume
manageable: one transfer to an operator's account rather than a hundred
small ones.

---

## The dispatch loop

This is the core of the marketplace and the first thing to build.

```
POST /bookings  →  booking created, deposit paid
                       │
                       ▼
         DispatchService.onBookingReady(booking)
                       │
              ┌────────┴────────┐
              │ find candidates   │  eligible: online, matching vehicle class,
              │                   │  operator active, not mid-trip,
              │ nearbyDrivers()   │  ranked by ETA, not straight-line distance
              └────────┬────────┘
                       ▼
         INSERT dispatch_offers (offered, expires_at = now + 45s)
         push notification to the driver app
                       │
       ┌───────────────┼───────────────┐
   accepted         declined        no response
       │               │               │
       ▼               ▼               ▼
  assign driver    re-offer to      expires → re-offer
  + notify rider   next candidate   (attempts++, give up → ops queue)
```

### Ranking is by ETA, not distance

A driver three kilometres away but heading the wrong way is worse than one
four kilometres away heading towards the rider. Distance is a proxy for ETA
and a bad one in Accra traffic.

OSRM's `duration` from the routing table is enough for the first cut, and it
is the same OSRM instance the route geometry already comes from. A
traffic-aware provider (TomTom or Google Directions) is the later upgrade,
and it is the same upgrade the infrastructure notes already flag as the
answer to "OSRM alone assumes free-flow speeds and will be optimistic in
Accra traffic".

### The correctness properties are DB-enforced

Same philosophy as the rental exclusion constraint: application code can
only ever handle the error, never cause the conflict.

1. **One booking, one accepted driver.** `one_live_offer_per_booking` makes a
   double-accept impossible. The loser gets `409` and a clean error.
2. **One driver, one job.** `one_accepted_offer_per_driver`.
3. **Claims do not queue.** `FOR UPDATE SKIP LOCKED` when offering, so two
   dispatch workers cannot offer the same driver twice.

### The manual path stays

`POST /tracking/:ref/assign` already exists and force-assigns a driver. It is
the escape hatch for every dispatch failure — no supply, no offers answered,
a driver who phoned in. It stays, and the ops console gets a button for it.

### Assign-and-accept, not open bidding

Uber-style open bidding, where drivers see nearby requests and grab them,
needs a supply culture that takes years to build and invites cherry-picking.
Cherry-picking is fatal for the airport run, which is the product.

Assign-and-accept — the platform picks the best driver, the driver accepts or
declines, the platform re-offers — delivers the reliability the homepage
promises at a fraction of the complexity. Driver-side incentives (below)
supply the density benefit without open bidding.

---

## Utilisation without surge

The hardest unsolved problem in this model, and it follows directly from the
positioning.

Uber's supply-side pain is utilisation, and it normally solves it with surge
pricing on the demand side. Digio has removed that lever: "no surge, ever" is
on the homepage, and it is the reason the product can be trusted.

So the platform needs a supply-side lever the rider never sees. That is the
unlock.

**Driver-side incentives — surge on the supply side.** A bonus paid to a
driver who accepts a job in an underserved zone, or accepts an airport run at
05:00. The rider's price does not move. The driver's effective earnings do.
It is invisible to the brand promise and fully effective on supply.

Implemented as an incentive rule table keyed on zone and time band, with the
bonus flowing through the ledger to `driver_payable`:

```sql
create table supply_incentives (
  id         uuid primary key default gen_random_uuid(),
  city_id    uuid not null references cities(id),
  zone_id    uuid references zones(id),
  time_band  text not null,        -- e.g. '05:00-08:00'
  bonus_minor integer not null,
  label      text not null,
  active     boolean not null default true
);
```

**Off-peak demand shaping.** Discounts pull demand into quiet hours instead
of paying to push supply into peak hours. Cheaper, and it compounds with the
promo engine that already exists.

**ETA accuracy is a utilisation tool.** Better ETAs mean trips finish faster
and drivers spend less time deadheading. It also means the fixed fare covers
reality.

**Deadhead-aware matching.** Bias offers towards drivers already heading
towards the pickup.

### Waiting time is a pricing input

The homepage promises 60 minutes free on flights and 10 minutes in town, with
tolls included. With a fixed fare, that wait is the platform's cost. So every
zone-pair fare has to be set to cover its expected wait, and waiting time
has to be tracked to know what "expected" means.

That makes fare management a live operational concern, which means fare
management belongs in the ops console, not in a seed script.

---

## Money flow

```
rider pays 100 ──Paystack──► payment (succeeded, verified webhook)
                                   │
                          ledger: rider_payable   → driver_payable    70
                                                → platform_revenue  25
                                                → gateway_fees       5
                                   │
                         driver_payable accumulates
                                   │
                   payout run (weekly, per operator)
                                   │
                   Paystack Transfer or Hubtel disbursement
                   ledger: driver_payable → cash_settled
```

### The decision this rests on

**The balance must go through the platform.** Today the rider hands 70% of
the fare to the driver in cash at handover. For a marketplace with
independent supply, that means the platform never sees most of its own
revenue, cannot compute commission, cannot guarantee the driver is paid, and
cannot refund.

Three models were considered:

| Model | How | Verdict |
| --- | --- | --- |
| **A. Full through-platform** | Rider pays 100% to the platform; platform takes commission and pays the driver | **Chosen.** The only model where commission, payouts, refunds and reconciliation work |
| B. Rider pays driver in cash | Driver owes the platform commission | Drivers default, disputes are manual, no guarantee of payment |
| C. Keep the 30% deposit only | No change | Not a marketplace. The platform cannot take a cut of its own business |

Model A means the `payments` table alone is no longer enough, which is why
the ledger exists.

### Two things to verify early

Both are external and both are on the critical path.

**The payout rail.** Paystack's Transfer API for Ghanaian mobile money —
confirm it covers MTN, Vodafone and AirtelTigo. If it does not, Hubtel
disburses to all three. `SMS_PROVIDER` already lists `hubtel` and `termii`
for messaging; disbursement is a separate product and needs its own
credentials.

**The refund path.** Needs a cancellation-policy table before it can be coded
honestly. The architecture notes already say this and it is still true.

```sql
create table cancellation_policies (
  id               uuid primary key default gen_random_uuid(),
  city_id          uuid not null references cities(id),
  product          text not null,
  free_until_hours integer not null,
  partial_pct      integer not null,
  no_show_fee_minor integer not null default 0,
  active           boolean not null default true
);
```

---

## Supply side

### The driver app

Expo, React Native. The screens in priority order:

1. **Availability toggle** — writes `driver_presence`
2. **Offer inbox with a countdown** — accept or decline
3. **Active trip** — navigate, mark arrived, mark complete, capture odometer
   and photos
4. **Earnings and next payout**
5. **Profile and document status**

Native matters here and nowhere else. The driver app is the one surface that
needs background location, push notifications and a map. The rider web app
does not.

### Onboarding is the real cost centre

Nothing here exists yet. `documents` is defined with `ownerType` and
`expires_at` for licence and roadworthy tracking, and never written to.

The flow:

```
operator application
  → operator vetting
    → driver signs up (phone OTP)
      → licence, insurance, roadworthy uploaded with expiry
        → vehicle assigned to driver
          → first shift
```

Document expiry feeds back into eligibility automatically. An expired licence
makes a driver ineligible for matching, discovered by the system rather than
by a customer at the airport.

### Ops console

A second web app, not a section of the rider site:

- **Live dispatch board** — unassigned bookings, available drivers, force-assign
- **Enquiry triage** — `enquiries` is write-only today and worked from the
  database by hand
- **Driver and operator management** — onboarding, documents, suspensions
- **Price and promo management** — zone-pair fares, incentives, promos
- **Outbox inspector** — message delivery, retries, failures

It needs real auth before it ships. `POST /notifications/dispatch` currently
drains the message queue with no authentication at all.

---

## Auth

| Audience | Method | Notes |
| --- | --- | --- |
| Rider | Phone OTP, JWT with refresh rotation | Ghana: WhatsApp first, SMS fallback. The phone number is already the customer key (`customers.phone`, unique, E.164) so identity is the phone number |
| Driver | Phone OTP plus device binding | Plus an operator membership check on every offer |
| Ops | TOTP plus RBAC | Roles: `admin`, `dispatcher`, `ops`, `finance`, `support` |

Riders can book as guests, with the phone verified at payment. They must be
identified to leave a rating. Forcing registration on the first booking costs
conversions in a market where trust comes from the driver's name, not a login
wall.

The backend README lists `auth/` — phone OTP, JWT rotation, admin TOTP and
RBAC — as the next module. It is the foundation for everything in the phases
below.

---

## Multi-city

Cities are a schema-level concern from day one. Retrofitting them after the
second city ships means touching prices, zones, money, phone numbers and
documents all at once.

**Money has to generalise.** "Integer pesewas" is baked into every type name
— `totalPesewas`, `depositPesewas`, `formatGhs`. Ghana's pesewa is two
decimals; yen has none; the dinar has three. Before city two, rename the
concept to `amountMinor` alongside a `currency` code, and make formatting
currency-aware. Cheaper now, while it is one codebase.

**Phone numbers have to generalise.** `normaliseGhanaPhone` is Ghana-specific
and correct for now. It moves behind a per-country normaliser when a second
country opens.

**Documents and compliance are per-country.** A Ghanaian licence row means
nothing in Kenya.

---

## Sequencing

The order is deliberate. Each phase makes the next one possible, and the
marketplace loop comes before the nice-to-haves.

### Phase 0 — stop the leaks

Days. The two pricing defects at the top of this document: the
client-supplied membership discount, and the promo minimum checked against
the base price instead of the subtotal. Both are on a live engine and both
cost money on every quote. Fix them in the pricing module, with tests.

### Phase 1 — supply-side identity and presence

One to two weeks.

- `auth/` with phone OTP, JWT rotation, roles
- `cities`, `operators`, `driver_presence`
- Driver and operator onboarding, document upload with expiry
- Driver availability toggle

Dispatch stays manual at the end of this phase, but now against real supply
that can go on and off duty.

### Phase 2 — the dispatch loop

Two to three weeks.

- `dispatch_offers` with the partial unique indexes
- Assign-and-accept, ETA ranking, expiry and re-offer
- Push notifications to the driver app
- `driver_assigned` notification event, so the rider gets the driver's name,
  rating and plate — which the homepage already promises

### Phase 3 — money through the platform

Three to four weeks, partly parallel with Phase 2.

- The ledger and its accounts
- Balance collected at trip completion, not handed over in cash
- Commission, operator settlement, driver payouts
- Cancellation policy and refunds

This is the phase where it becomes a business rather than a booking site.

### Phase 4 — ops console and supply operations

Runs alongside Phases 2 and 3.

- Live dispatch board, force-assign
- Enquiry triage
- Driver and operator management
- Price, promo and incentive management
- Outbox inspector
- Auth on the internal routes

### Phase 5 — multi-city and utilisation

When city two is real.

- Currency generalisation, per-city zones and pricing
- Supply incentives
- Traffic-aware ETA
- Flight tracking, waiting-time tracking, reminders

### Phase 6 — the promises the homepage already makes

- Flight tracking and automatic pick-up adjustment
- Chauffeur name, rating and plate to WhatsApp before arrivals
- Free waiting allowance enforced
- Tolls included, in the fare

Phases 1 to 3 are the marketplace. Phases 5 and 6 are the fulfilment of copy
that has already been written.

---

## What not to build yet

- **Open driver bidding.** Assign-and-accept first. Revisit when supply
  density demands it.
- **Microservices.** The seams are already right and the transactions are
  load-bearing.
- **Surge, in any form.** Driver-side incentives instead.
- **A rider native app.** The web app is PWA-first and covers it. The driver
  app is where native earns its keep.
- **Multi-currency code paths before city two is signed.** But do rename
  pesewas to minor units now, while it is one codebase.
- **Optimistic concurrency on everything.** Only where two actors genuinely
  race: offers and payouts.
- **A driver-rider rating system before the trip loop exists.** Ratings need
  completed trips to be worth anything.

---

## Decisions still open

Two questions change the shape of Phases 2 and 3 materially, and are better
answered by the business than by the code.

**Does the balance move through the platform, or is cash at handover the real
plan for Ghana?** Everything in Phase 3 assumes it moves through the
platform. If cash at handover is genuinely the market's shape, then the
take rate has to be collected from drivers directly and the model becomes
Uber's cash-market variant, which is a different ledger.

**Is the driver-side an app where drivers accept jobs, or a dispatcher
assigns?** This document assumes accept-and-decline, because it is what
keeps the airport run reliable. A pure dispatcher-assign model is simpler
still, and it changes the driver app down to a status toggle and a map.

Also worth settling before Phase 1:

- **Is "Vesper" a membership product?** It exists as a discount tier in the
  schema with no signup, no subscription and no way to earn it. If it is a
  real product, it needs a subscription and a benefits page. If it is not,
  the discount code should go.
- **Who is the first operator?** The whole supply side assumes at least one
  partner fleet in Accra. If Digio runs its own cars for now, `operators` is
  still the right model — Digio is simply the first operator, and
  `agreement_signed_at` becomes an internal fact rather than a contract.
