import { relations } from 'drizzle-orm';
import {
  boolean,
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
  customType,
} from 'drizzle-orm/pg-core';

/**
 * Postgres range used to make double-booking physically impossible.
 */
export const dateRange = customType<{ data: string; driverData: string }>({
  dataType() {
    return 'daterange';
  },
});

export const productType = pgEnum('product_type', [
  'chauffeur_transfer',
  'chauffeur_hire',
  'self_drive',
]);

export const bookingStatus = pgEnum('booking_status', [
  'pending',
  'deposit_paid',
  'assigned',
  'in_progress',
  'completed',
  'cancelled',
  'expired',
]);

export const vehicleStatus = pgEnum('vehicle_status', [
  'available',
  'on_trip',
  'servicing',
  'retired',
]);

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

export const enquiryKind = pgEnum('enquiry_kind', [
  'jet',
  'yacht',
  'corporate',
  'wedding',
  'long_term',
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
  (table) => [
    uniqueIndex('zone_pairs_unique_idx').on(table.fromZoneId, table.toZoneId, table.classId),
  ],
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
    amountPesewas: integer('amount_pesewas').notNull(),
    channel: paymentChannel('channel').notNull(),
    status: paymentStatus('status').notNull().default('initialized'),
    /** Full provider payload for reconciliation and disputes. */
    raw: jsonb('raw').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('payments_booking_idx').on(table.bookingId)],
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
