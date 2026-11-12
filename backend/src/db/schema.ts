import { relations } from 'drizzle-orm';
import {
  boolean,
  customType,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * Postgres range used to make double-booking physically impossible.
 */
export const dateRange = customType<{ data: string; driverData: string }>({
  dataType() {
    return 'daterange';
  },
});

/**
 * PostGIS point. drizzle-kit quotes type names containing parentheses, so the
 * generated migration is reviewed by hand before it runs — the same treatment
 * the `zones.centroid` column already gets (see migration 0000).
 */
export const geographyPoint = customType<{ data: string; driverData: string }>({
  dataType() {
    return 'geography(Point,4326)';
  },
});

export const productType = pgEnum('product_type', ['chauffeur_transfer', 'chauffeur_hire', 'self_drive']);

export const bookingStatus = pgEnum('booking_status', [
  'pending',
  'deposit_paid',
  'assigned',
  'in_progress',
  'completed',
  'cancelled',
  'expired',
]);

export const vehicleStatus = pgEnum('vehicle_status', ['available', 'on_trip', 'servicing', 'retired']);

export const driverStatus = pgEnum('driver_status', ['available', 'on_trip', 'off_duty']);

export const paymentStatus = pgEnum('payment_status', [
  'initialized',
  'pending',
  'succeeded',
  'failed',
  'refunded',
]);

export const paymentChannel = pgEnum('payment_channel', [
  'mobile_money',
  'card',
  'bank_transfer',
  'cash',
  'corporate_invoice',
]);

export const discountType = pgEnum('discount_type', ['percent', 'fixed']);

export const documentOwner = pgEnum('document_owner', ['driver', 'vehicle', 'customer']);

export const enquiryKind = pgEnum('enquiry_kind', ['jet', 'yacht', 'corporate', 'wedding', 'long_term']);

/** A deposit secures the booking; the balance is collected later. */
export const paymentKind = pgEnum('payment_kind', ['deposit', 'balance']);

export const notificationEvent = pgEnum('notification_event', [
  'booking.confirmed',
  'booking.reminder',
  'booking.cancelled',
  'payment.failed',
  'payment.received',
]);

export const notificationChannel = pgEnum('notification_channel', ['whatsapp', 'sms']);

export const notificationStatus = pgEnum('notification_status', [
  'queued',
  'sending',
  'sent',
  'failed',
  'cancelled',
]);

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

export const vehicleClasses = pgTable('vehicle_classes', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  seats: integer('seats').notNull(),
  bags: integer('bags').notNull(),
  /** Applied to the zone-pair base price. 1.00 = sedan. */
  multiplier: numeric('multiplier', { precision: 4, scale: 2 }).notNull().default('1.00'),
  /** Chauffeur day hire rate for this class. Self-drive uses the vehicle's own rate. */
  chauffeurDayRatePesewas: integer('chauffeur_day_rate_pesewas').notNull().default(0),
  /** Refundable hold for self-drive; never part of the rental total. */
  securityDepositPesewas: integer('security_deposit_pesewas').notNull().default(0),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const vehicles = pgTable(
  'vehicles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    classId: uuid('class_id')
      .notNull()
      .references(() => vehicleClasses.id),
    plate: text('plate').notNull().unique(),
    make: text('make').notNull(),
    model: text('model').notNull(),
    year: integer('year').notNull(),
    color: text('color').notNull().default('black'),
    status: vehicleStatus('status').notNull().default('available'),
    /** Self-drive day rate. Chauffeur pricing comes from zone pairs. */
    dailyRatePesewas: integer('daily_rate_pesewas').notNull().default(0),
    mileageCapKm: integer('mileage_cap_km').notNull().default(200),
    transmission: text('transmission').notNull().default('automatic'),
    fuel: text('fuel').notNull().default('petrol'),
    seats: integer('seats'),
    bags: integer('bags'),
    photos: jsonb('photos').$type<string[]>().notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('vehicles_class_idx').on(table.classId, table.status)],
);

export const drivers = pgTable('drivers', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  phone: text('phone').notNull().unique(),
  licenceNo: text('licence_no'),
  licenceExpiry: date('licence_expiry'),
  rating: numeric('rating', { precision: 3, scale: 2 }).notNull().default('5.00'),
  languages: text('languages').array().notNull().default([]),
  status: driverStatus('status').notNull().default('available'),
  /** The car this driver is paired with; live tracking reports it to riders. */
  vehicleId: uuid('vehicle_id').references(() => vehicles.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const zones = pgTable('zones', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  airport: boolean('airport').notNull().default(false),
  lat: numeric('lat', { precision: 9, scale: 6 }),
  lng: numeric('lng', { precision: 9, scale: 6 }),
  sortOrder: integer('sort_order').notNull().default(0),
  active: boolean('active').notNull().default(true),
});

/**
 * Fixed price for a directional zone pair per vehicle class.
 * The airport is both an origin and a destination, so pairs are directional.
 */
export const zonePairs = pgTable(
  'zone_pairs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    fromZoneId: uuid('from_zone_id')
      .notNull()
      .references(() => zones.id),
    toZoneId: uuid('to_zone_id')
      .notNull()
      .references(() => zones.id),
    classId: uuid('class_id')
      .notNull()
      .references(() => vehicleClasses.id),
    pricePesewas: integer('price_pesewas').notNull(),
    active: boolean('active').notNull().default(true),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('zone_pairs_unique_idx').on(table.fromZoneId, table.toZoneId, table.classId)],
);

export const promos = pgTable('promos', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  type: discountType('type').notNull(),
  /** Percent as whole number (10 = 10%) or fixed amount in pesewas. */
  value: integer('value').notNull(),
  minSubtotalPesewas: integer('min_subtotal_pesewas').notNull().default(0),
  maxDiscountPesewas: integer('max_discount_pesewas'),
  maxUses: integer('max_uses'),
  usedCount: integer('used_count').notNull().default(0),
  validFrom: timestamp('valid_from', { withTimezone: true }),
  validTo: timestamp('valid_to', { withTimezone: true }),
  active: boolean('active').notNull().default(true),
});

// ---------------------------------------------------------------------------
// Customers, quotes, bookings
// ---------------------------------------------------------------------------

export const customers = pgTable('customers', {
  id: uuid('id').primaryKey().defaultRandom(),
  phone: text('phone').notNull().unique(),
  name: text('name'),
  email: text('email'),
  /** Vesper membership discount, expressed as a percentage. */
  membershipPercent: integer('membership_percent').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const quotes = pgTable(
  'quotes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    token: text('token').notNull().unique(),
    product: productType('product').notNull(),
    /** Frozen request + resolved rate context. Everything needed to re-price. */
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    breakdown: jsonb('breakdown').$type<Record<string, unknown>>().notNull(),
    subtotalPesewas: integer('subtotal_pesewas').notNull(),
    discountPesewas: integer('discount_pesewas').notNull().default(0),
    totalPesewas: integer('total_pesewas').notNull(),
    depositPesewas: integer('deposit_pesewas').notNull(),
    /** Refundable hold, reported separately from the price. Rentals only. */
    securityDepositPesewas: integer('security_deposit_pesewas').notNull().default(0),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('quotes_token_idx').on(table.token)],
);

export const bookings = pgTable(
  'bookings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ref: text('ref').notNull().unique(),
    product: productType('product').notNull(),
    status: bookingStatus('status').notNull().default('pending'),
    customerId: uuid('customer_id').references(() => customers.id),
    quoteId: uuid('quote_id').references(() => quotes.id),
    vehicleId: uuid('vehicle_id').references(() => vehicles.id),
    driverId: uuid('driver_id').references(() => drivers.id),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    pickupLabel: text('pickup_label').notNull(),
    dropoffLabel: text('dropoff_label').notNull(),
    passengers: integer('passengers').notNull().default(1),
    bags: integer('bags').notNull().default(0),
    flightNumber: text('flight_number'),
    subtotalPesewas: integer('subtotal_pesewas').notNull(),
    discountPesewas: integer('discount_pesewas').notNull().default(0),
    totalPesewas: integer('total_pesewas').notNull(),
    depositDuePesewas: integer('deposit_due_pesewas').notNull(),
    /** Rental only: days charged and the refundable security hold. */
    rentalDays: integer('rental_days'),
    deliveryFeePesewas: integer('delivery_fee_pesewas').notNull().default(0),
    securityDepositPesewas: integer('security_deposit_pesewas').notNull().default(0),
    paidPesewas: integer('paid_pesewas').notNull().default(0),
    currency: text('currency').notNull().default('GHS'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('bookings_starts_at_idx').on(table.startsAt),
    index('bookings_status_idx').on(table.status),
  ],
);

/**
 * One row per reserved vehicle period. The EXCLUDE constraint added in the
 * migration makes overlapping reservations impossible at the storage layer,
 * regardless of application bugs.
 */
export const rentalPeriods = pgTable(
  'rental_periods',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    vehicleId: uuid('vehicle_id')
      .notNull()
      .references(() => vehicles.id),
    bookingId: uuid('booking_id')
      .notNull()
      .references(() => bookings.id, { onDelete: 'cascade' }),
    period: dateRange('period').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('rental_periods_vehicle_idx').on(table.vehicleId)],
);

export const payments = pgTable(
  'payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bookingId: uuid('booking_id')
      .notNull()
      .references(() => bookings.id),
    provider: text('provider').notNull().default('paystack'),
    providerRef: text('provider_ref').notNull().unique(),
    /** Deposit or balance. A booking can have more than one successful payment. */
    kind: paymentKind('kind').notNull().default('deposit'),
    amountPesewas: integer('amount_pesewas').notNull(),
    channel: paymentChannel('channel').notNull(),
    status: paymentStatus('status').notNull().default('initialized'),
    /** Paystack access code, used to resume an abandoned checkout. */
    accessCode: text('access_code'),
    authorizationUrl: text('authorization_url'),
    failureReason: text('failure_reason'),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    /** Full provider payload for reconciliation and disputes. */
    raw: jsonb('raw').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('payments_booking_idx').on(table.bookingId),
    index('payments_status_idx').on(table.status),
  ],
);

/**
 * Transactional outbox for customer messaging.
 *
 * A row is written in the same transaction that confirms a payment, so a message
 * can never be lost between "payment succeeded" and "notification queued".
 * The unique key makes delivery idempotent: replaying a webhook cannot enqueue
 * the same message twice.
 */
export const notificationOutbox = pgTable(
  'notification_outbox',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bookingId: uuid('booking_id').references(() => bookings.id, { onDelete: 'cascade' }),
    event: notificationEvent('event').notNull(),
    channel: notificationChannel('channel').notNull(),
    recipient: text('recipient').notNull(),
    template: text('template').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
    status: notificationStatus('status').notNull().default('queued'),
    attempts: integer('attempts').notNull().default(0),
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }).notNull().defaultNow(),
    lastError: text('last_error'),
    providerRef: text('provider_ref'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('notification_outbox_unique_idx').on(table.bookingId, table.event, table.channel),
    index('notification_outbox_due_idx').on(table.status, table.nextAttemptAt),
  ],
);

export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerType: documentOwner('owner_type').notNull(),
  ownerId: uuid('owner_id').notNull(),
  kind: text('kind').notNull(),
  fileKey: text('file_key').notNull(),
  expiresAt: date('expires_at'),
  verified: boolean('verified').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const enquiries = pgTable('enquiries', {
  id: uuid('id').primaryKey().defaultRandom(),
  kind: enquiryKind('kind').notNull(),
  name: text('name').notNull(),
  phone: text('phone').notNull(),
  email: text('email'),
  message: text('message'),
  payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
  status: text('status').notNull().default('new'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Live trip tracking
// ---------------------------------------------------------------------------

/**
 * One row per driver — the latest ping wins. The GiST index on `location`
 * backs the ST_DWithin/ST_Distance "nearest car" query.
 */
export const driverLocations = pgTable(
  'driver_locations',
  {
    driverId: uuid('driver_id')
      .primaryKey()
      .references(() => drivers.id, { onDelete: 'cascade' }),
    location: geographyPoint('location').notNull(),
    /** Compass bearing in degrees, 0–360. */
    heading: numeric('heading', { precision: 5, scale: 2 }),
    speedKph: numeric('speed_kph', { precision: 5, scale: 2 }),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('driver_locations_location_idx').using('gist', table.location)],
);

/**
 * The route a booking will play back (`kind = 'route'`, seeded from OSRM at
 * assignment) plus the positions actually driven (`kind = 'trace'`, appended by
 * the simulator or a real driver app). The discriminator keeps `route`
 * stable while the trace grows.
 */
export const tripPositions = pgTable(
  'trip_positions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bookingId: uuid('booking_id')
      .notNull()
      .references(() => bookings.id, { onDelete: 'cascade' }),
    seq: integer('seq').notNull(),
    lat: numeric('lat', { precision: 9, scale: 6 }).notNull(),
    lng: numeric('lng', { precision: 9, scale: 6 }).notNull(),
    kind: text('kind').notNull().default('route'),
    /**
     * Metres along the route when this point was recorded. Playback resumes
     * from this number: projecting the raw lat/lng back onto the polyline is
     * ambiguous when a route crosses or retraces itself.
     */
    distanceAlong: numeric('distance_along', { precision: 10, scale: 2 }),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('trip_positions_booking_seq_idx').on(table.bookingId, table.seq)],
);

// ---------------------------------------------------------------------------
// Relations (query convenience only)
// ---------------------------------------------------------------------------

export const vehiclesRelations = relations(vehicles, ({ one }) => ({
  class: one(vehicleClasses, {
    fields: [vehicles.classId],
    references: [vehicleClasses.id],
  }),
}));

export const bookingsRelations = relations(bookings, ({ one, many }) => ({
  customer: one(customers, { fields: [bookings.customerId], references: [customers.id] }),
  quote: one(quotes, { fields: [bookings.quoteId], references: [quotes.id] }),
  vehicle: one(vehicles, { fields: [bookings.vehicleId], references: [vehicles.id] }),
  driver: one(drivers, { fields: [bookings.driverId], references: [drivers.id] }),
  payments: many(payments),
}));
