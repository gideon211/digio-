import Link from 'next/link';
import { notFound } from 'next/navigation';
import { api, formatGhs } from '@/lib/api';
import { CancelButton } from './cancel-button';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<string, string> = {
  pending: 'Awaiting deposit',
  deposit_paid: 'Deposit paid',
  assigned: 'Chauffeur assigned',
  in_progress: 'On the way',
  completed: 'Completed',
  cancelled: 'Cancelled',
  expired: 'Expired',
};

export default async function ManageBookingPage({
  params,
}: {
  params: Promise<{ ref: string }>;
}) {
  const { ref } = await params;

  const data = await Promise.all([api.getBooking(ref), api.listPayments(ref)]).catch(() => null);
  if (!data) notFound();

  const [booking, payments] = data;

  const cancellable = booking.status === 'pending' || booking.status === 'deposit_paid';

  return (
    <main className="app-shell pt-5">
      <header className="mb-4 flex items-center justify-between">
        <Link href="/" className="font-display text-xl font-bold">
          Digio<span className="text-gold">.</span>
        </Link>
        <span className="text-xs text-muted">Manage booking</span>
      </header>

      <section className="mb-4 rounded-[20px] bg-forest px-5 py-6 text-hero-ink">
        <p className="text-[11px] tracking-[0.08em] uppercase opacity-70">
          {STATUS_LABEL[booking.status] ?? booking.status}
        </p>
        <h1 className="mt-1 font-display text-[26px] leading-tight font-bold">{booking.ref}</h1>
        <p className="mt-2 text-sm opacity-85">
          {booking.pickup} → {booking.dropoff}
        </p>
        <p className="mt-1 text-sm opacity-85">{formatWhen(booking.startsAt)} (Accra)</p>
      </section>

      <section className="card mb-3">
        <h2 className="font-display text-[15px] font-bold">Trip</h2>
        <dl className="mt-2 grid gap-2 text-sm">
          <Row label="Pick-up" value={booking.pickup} />
          <Row label="Drop-off" value={booking.dropoff} />
          <Row label="Date" value={formatWhen(booking.startsAt)} />
          <Row label="Passengers" value={`${booking.passengers} · ${booking.bags} bags`} />
          {booking.flightNumber ? <Row label="Flight" value={booking.flightNumber} /> : null}
        </dl>
      </section>

      <section className="card mb-3">
        <h2 className="font-display text-[15px] font-bold">Payment</h2>
        <dl className="mt-2 grid gap-2 text-sm">
          <Row label="Total" value={formatGhs(booking.totalPesewas)} />
          <Row label="Paid" value={formatGhs(booking.paidPesewas)} />
          <Row label="Balance" value={formatGhs(booking.balancePesewas)} />
        </dl>

        {payments.length > 0 ? (
          <ul className="mt-3 divide-y divide-line border-t border-line">
            {payments.map((payment) => (
              <li key={payment.reference} className="flex items-baseline justify-between py-2">
                <div>
                  <p className="text-[13px] font-medium capitalize">{payment.status}</p>
                  <p className="tabular text-[11px] text-muted">{payment.reference}</p>
                </div>
                <span className="tabular text-[13px]">{formatGhs(payment.amountPesewas)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-xs text-muted">
            No payment yet. The deposit holds the car; the balance is settled on the day.
          </p>
        )}
      </section>

      {cancellable ? <CancelButton bookingRef={booking.ref} /> : null}

      <Link href="/book" className="btn-secondary mt-2">
        Book another ride
      </Link>

      <p className="mt-4 text-center text-xs text-muted">
        Need to change something? Reply to the WhatsApp confirmation and the team will handle it.
      </p>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'To be confirmed';

  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Accra',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}
