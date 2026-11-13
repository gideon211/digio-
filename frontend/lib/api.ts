export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1';

export interface VehicleClass {
  slug: string;
  name: string;
  description: string;
  seats: number;
  bags: number;
  multiplier: number;
  /** Cheapest self-drive day rate in this class, in pesewas. */
  dailyRateFromPesewas: number;
  chauffeurDayRatePesewas: number;
  securityDepositPesewas: number;
  availableVehicles: number;
}

export interface RentalClass {
  slug: string;
  name: string;
  seats: number;
  bags: number;
  dailyRateFromPesewas: number;
  chauffeurDayRatePesewas: number;
  securityDepositPesewas: number;
  availableVehicles: number;
}

export interface RentalAvailability {
  fromDate: string;
  toDate: string;
  days: number;
  classes: RentalClass[];
}

export interface RentalVehicle {
  id: string;
  plate: string;
  make: string;
  model: string;
  year: number;
  color: string;
  dailyRatePesewas: number;
}

export interface RentalQuoteDetails {
  vehiclePlate: string;
  vehicleDescription: string;
  fromDate: string;
  toDate: string;
  days: number;
  securityDepositPesewas: number;
}

export interface Zone {
  slug: string;
  name: string;
  airport: boolean;
  lat: number | null;
  lng: number | null;
  sortOrder: number;
}

export interface Extra {
  code: string;
  label: string;
  pricePesewas: number;
}

/** One OSM place from the server-side Photon proxy. */
export interface Place {
  label: string;
  lat: number;
  lng: number;
  kind: 'airport' | 'place' | 'street' | 'poi' | 'other';
}

/** The pricing zone a point falls in, decided by PostGIS — never by the client. */
export interface ZoneMatch {
  zone: { slug: string; name: string; airport: boolean } | null;
  distanceMetres: number;
  withinServiceArea: boolean;
}

export type LocateResult = ZoneMatch & { place: Place | null };

export interface RentalExtra {
  code: string;
  label: string;
  dailyPesewas: number;
}

export interface Catalog {
  vehicleClasses: VehicleClass[];
  zones: Zone[];
  extras: Extra[];
  rentalExtras: RentalExtra[];
}

/** One published airport fare for one class. */
export interface FarePrice {
  classSlug: string;
  className: string;
  pricePesewas: number;
}

/** One destination priced from the airport. */
export interface FareRoute {
  zoneSlug: string;
  zone: string;
  prices: FarePrice[];
}

/**
 * The published price list from `GET /catalog/fares`. Priced by the same
 * engine as a booking, so a number shown here and a number charged there
 * cannot drift apart.
 */
export interface FareList {
  from: string;
  routes: FareRoute[];
}

export interface LineItem {
  code: string;
  label: string;
  amountPesewas: number;
}

/** One class priced on a route. Browsing issues no token, so it reserves nothing. */
export interface TransferPrice {
  classSlug: string;
  name: string;
  description: string;
  seats: number;
  bags: number;
  availableVehicles: number;
  subtotalPesewas: number;
  discountPesewas: number;
  totalPesewas: number;
  depositPesewas: number;
  balancePesewas: number;
  lineItems: LineItem[];
}

export interface Quote {
  token: string;
  product: string;
  currency: 'GHS';
  expiresAt: string;
  route: { from: string; to: string; vehicleClass: string };
  lineItems: LineItem[];
  subtotalPesewas: number;
  discountPesewas: number;
  totalPesewas: number;
  depositPesewas: number;
  balancePesewas: number;
  /** Present for self-drive and chauffeur day hire. */
  rental?: RentalQuoteDetails;
}

export interface Booking {
  ref: string;
  status: string;
  product: string;
  currency: string;
  pickup: string;
  dropoff: string;
  startsAt: string;
  endsAt: string;
  passengers: number;
  bags: number;
  flightNumber: string | null;
  subtotalPesewas: number;
  discountPesewas: number;
  totalPesewas: number;
  depositDuePesewas: number;
  paidPesewas: number;
  balancePesewas: number;
  payment: { status: 'unpaid' | 'part_paid' | 'deposit_paid' | 'paid_in_full'; channel: string };
  vehicle: { plate: string; description: string } | null;
  rental: {
    days: number;
    fromDate: string;
    toDate: string;
    deliveryFeePesewas: number;
    securityDepositPesewas: number;
  } | null;
  createdAt: string;
}

export interface Payment {
  reference: string;
  bookingRef: string;
  kind: 'deposit' | 'balance';
  amountPesewas: number;
  currency: 'GHS';
  channel: string;
  status: 'initialized' | 'pending' | 'succeeded' | 'failed' | 'refunded';
  authorizationUrl: string | null;
  simulated: boolean;
  paidAt: string | null;
  createdAt: string;
}

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
    cache: 'no-store',
  });

  const body = (await response.json().catch(() => null)) as
    | { error?: { code?: string; message?: string } }
    | null;

  if (!response.ok) {
    throw new ApiError(
      body?.error?.code ?? 'REQUEST_FAILED',
      body?.error?.message ?? 'Something went wrong',
      response.status,
    );
  }

  return body as T;
}

export const api = {
  searchPlaces: (input: { q: string; limit?: number; lat?: number; lng?: number }) =>
    request<{ places: Place[] }>(
      `/locations/search?q=${encodeURIComponent(input.q)}&limit=${input.limit ?? 6}` +
        (input.lat === undefined ? '' : `&lat=${input.lat}`) +
        (input.lng === undefined ? '' : `&lng=${input.lng}`),
    ),

  /** Reverse geocode plus zone resolution — what "use my location" calls. */
  locate: (input: { lat: number; lng: number }) =>
    request<LocateResult>(`/locations/locate?lat=${input.lat}&lng=${input.lng}`),

  resolveZone: (input: { lat: number; lng: number }) =>
    request<ZoneMatch>(`/locations/resolve?lat=${input.lat}&lng=${input.lng}`),

  catalog: () => request<Catalog>('/catalog'),

  /** Published airport price list — every city zone, every class. */
  fares: () => request<FareList>('/catalog/fares'),

  sendEnquiry: (input: {
    kind: 'jet' | 'yacht' | 'corporate' | 'wedding' | 'long_term' | 'city';
    name: string;
    phone: string;
    email?: string;
    message?: string;
  }) =>
    request<{ id: string; kind: string; status: string }>('/enquiries', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  /** Prices every class on a route at once, without issuing a quote token. */
  compareTransfers: (input: {
    fromZoneSlug: string;
    toZoneSlug: string;
    passengers: number;
    bags: number;
    extras: string[];
    promoCode?: string;
  }) => request<TransferPrice[]>('/quotes/transfer-compare', {
    method: 'POST',
    body: JSON.stringify(input),
  }),

  createChauffeurQuote: (input: {
    classSlug: string;
    fromZoneSlug: string;
    toZoneSlug: string;
    passengers: number;
    bags: number;
    startsAt: string;
    flightNumber?: string;
    extras: string[];
    promoCode?: string;
  }) =>
    request<Quote>('/quotes/chauffeur', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  rentalClasses: (input: { fromDate: string; toDate: string }) =>
    request<RentalAvailability>(
      `/rentals/classes?fromDate=${input.fromDate}&toDate=${input.toDate}`,
    ),

  rentalAvailability: (input: { classSlug: string; fromDate: string; toDate: string }) =>
    request<{ classSlug: string; fromDate: string; toDate: string; days: number; vehicles: RentalVehicle[] }>(
      `/rentals/availability?classSlug=${encodeURIComponent(input.classSlug)}&fromDate=${input.fromDate}&toDate=${input.toDate}`,
    ),

  createRentalQuote: (input: {
    product: 'self_drive' | 'chauffeur_hire';
    classSlug: string;
    fromDate: string;
    toDate: string;
    deliveryZoneSlug?: string;
    extras: string[];
    promoCode?: string;
  }) =>
    request<Quote>('/quotes/rental', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  createBooking: (input: {
    quoteToken: string;
    customer: { name: string; phone: string };
    paymentChannel?: 'mobile_money' | 'card';
    notes?: string;
  }) =>
    request<Booking>('/bookings', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  getBooking: (ref: string) => request<Booking>(`/bookings/${ref}`),

  cancelBooking: (ref: string) =>
    request<Booking>(`/bookings/${ref}/cancel`, { method: 'POST' }),

  initializePayment: (input: {
    bookingRef: string;
    channel?: 'mobile_money' | 'card';
    email?: string;
    callbackUrl?: string;
  }) =>
    request<Payment & { email: string }>('/payments/initialize', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  getPayment: (reference: string) => request<Payment>(`/payments/${reference}`),

  listPayments: (bookingRef: string) => request<Payment[]>(`/payments/booking/${bookingRef}`),
};

/** GH₵ formatting for display only — the API always returns integer pesewas. */
export function formatGhs(pesewas: number): string {
  return new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency: 'GHS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(pesewas / 100);
}
