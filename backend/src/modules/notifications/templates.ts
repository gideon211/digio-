/**
 * Message copy lives here, keyed by template name and channel.
 *
 * SMS stays inside GSM-7 (no ₵ symbol): one non-GSM character switches the
 * whole message to UCS-2 and cuts the segment size from 160 to 70 characters.
 */

export interface BookingConfirmedPayload {
  ref: string;
  pickup: string;
  dropoff: string;
  startsAt: string;
  totalPesewas: number;
  paidPesewas: number;
  balancePesewas: number;
  manageUrl: string;
}

const ACCRA = 'Africa/Accra';

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'TBC';

  return new Intl.DateTimeFormat('en-GB', {
    timeZone: ACCRA,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function cedis(pesewas: number): string {
  return (Math.round(pesewas) / 100).toLocaleString('en-GH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export function renderBookingConfirmed(
  channel: 'whatsapp' | 'sms',
  payload: BookingConfirmedPayload,
): string {
  const when = formatWhen(payload.startsAt);

  if (channel === 'sms') {
    return (
      `Digio: ${payload.ref} confirmed. ${payload.pickup} to ${payload.dropoff}, ${when}. ` +
      `Deposit GHS ${cedis(payload.paidPesewas)}. ${payload.manageUrl}`
    );
  }

  return [
    `Your Digio booking is confirmed.`,
    ``,
    `Ref: ${payload.ref}`,
    `${payload.pickup} → ${payload.dropoff}`,
    `${when} (Accra)`,
    ``,
    `Total: GH₵${cedis(payload.totalPesewas)}`,
    `Deposit paid: GH₵${cedis(payload.paidPesewas)}`,
    `Balance: GH₵${cedis(payload.balancePesewas)}`,
    ``,
    `Manage your booking: ${payload.manageUrl}`,
    ``,
    `Reply here if anything changes.`,
  ].join('\n');
}

export const TEMPLATES = {
  'booking_confirmed_v1': renderBookingConfirmed,
} as const;

export type TemplateName = keyof typeof TEMPLATES;
