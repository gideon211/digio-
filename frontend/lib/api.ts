export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1';

export interface VehicleClass {
  slug: string;
  name: string;
  description: string;
  seats: number;
  bags: number;
  multiplier: number;
  availableVehicles: number;
}

export interface Zone {
  slug: string;
  name: string;
  airport: boolean;
  sortOrder: number;
}

export interface Extra {
  code: string;
  label: string;
  pricePesewas: number;
}

export interface Catalog {
  vehicleClasses: VehicleClass[];
  zones: Zone[];
  extras: Extra[];
}

export interface LineItem {
  code: string;
  label: string;
  amountPesewas: number;
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
}

export interface Booking {
  ref: string;
  status: string;
  totalPesewas: number;
  depositDuePesewas: number;
  pickup: string;
  dropoff: string;
  startsAt: string;
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
  catalog: () => request<Catalog>('/catalog'),

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
