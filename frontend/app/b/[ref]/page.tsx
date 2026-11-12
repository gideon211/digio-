import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CarArt, carKindForLabel } from '@/components/car-art';
import { api, formatGhs } from '@/lib/api';
import { CancelButton } from './cancel-button';
import { PayDepositButton } from './pay-button';

export const dynamic = 'force-dynamic';

const STATUS: Record<string, { label: string; chip: string }> = {
  pending: { label: 'Awaiting deposit', chip: 'bg-warning-bg text-warning' },
  deposit_paid: { label: 'Deposit paid', chip: 'bg-success-bg text-success' },
  assigned: { label: 'Chauffeur assigned', chip: 'bg-gold-subtle text-gold-text' },
  in_progress: { label: 'On the way', chip: 'bg-gold-subtle text-gold-text' },
  completed: { label: 'Completed', chip: 'bg-success-bg text-success' },
  cancelled: { label: 'Cancelled', chip: 'bg-danger-bg text-danger' },
  expired: { label: 'Expired', chip: 'bg-danger-bg text-danger' },
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
  const status = STATUS[booking.status] ?? { label: booking.status, chip: 'bg-sunken text-muted' };
  const cancellable = booking.status === 'pending' || booking.status === 'deposit_paid';
  const awaitingDeposit = booking.status === 'pending';
  const rental = booking.rental;

  return (
    <main className="app-shell pt-6 pb-4">
      <div className="stack grid gap-4">
        {/* ── Status ── */}
        <section className="band-dark on-dark p-6">
          <span className={`chip border-transparent ${status.chip}`}>{status.label}</span>
          <h1 className="mt-3 font-display text-display-lg text-hero-ink">{booking.ref}</h1>
          <p className="mt-2 text-body-sm text-hero-ink/80">
            {rental
              ? [
                  booking.vehicle
                    ? `${booking.vehicle.description} · ${booking.vehicle.plate}`
                    : null,
                  `${rental.fromDate} → ${rental.toDate}`,
                ]
                  .filter(Boolean)
                  .join(' · ')
              : `${booking.pickup} → ${booking.dropoff}`}
          </p>
          <p className="mt-1 text-caption text-hero-ink/60">
            {formatWhen(booking.startsAt)} (Accra)
          </p>
        </section>

        {/* ── Details ── */}
        <section className="card">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-display-sm text-ink">{rental ? 'Hire' : 'Trip'}</h2>
            {booking.vehicle ? (
              <CarArt
                kind={carKindForLabel(booking.vehicle.description)}
                className="h-8 w-16 text-forest"
              />
            ) : null}
          </div>

          <dl className="mt-4 grid gap-2.5">
            {booking.vehicle ? (
              <Row label="Car" value={`${booking.vehicle.description} · ${booking.vehicle.plate}`} />
            ) : null}
            <Row label="Pick-up" value={booking.pickup} />
            <Row label="Drop-off" value={booking.dropoff} />
            {rental ? (
              <>
                <Row label="Collect" value={formatDay(rental.fromDate)} />
                <Row label="Return" value={formatDay(rental.toDate)} />
                <Row
                  label="Hire"
                  value={`${rental.days} day${rental.days === 1 ? '' : 's'}`}
                />
                <Row label="Passengers" value={`${booking.passengers} · ${booking.bags} bags`} />
              </>
            ) : (
              <>
                <Row label="Date" value={formatWhen(booking.startsAt)} />
                <Row
                  label="Passengers"
                  value={`${booking.passengers} · ${booking.bags} bags`}
                />
              </>
            )}
            {booking.flightNumber ? <Row label="Flight" value={booking.flightNumber} /> : null}
          </dl>
        </section>

        {/* ── Security hold: a rental extra, never part of the price ── */}
        {rental && rental.securityDepositPesewas > 0 ? (
          <section className="card">
            <h2 className="font-display text-display-sm text-ink">Security hold</h2>
            <p className="mt-2 text-body-sm text-muted">
              {formatGhs(rental.securityDepositPesewas)} is held when you collect the car and
              released when it comes back clean. It is not part of the price below.
            </p>
          </section>
        ) : null}

        {/* ── Payment ── */}
        <section className="card">
          <h2 className="font-display text-display-sm text-ink">Payment</h2>

          <dl className="mt-4 grid gap-2.5">
            <Row label="Total" value={formatGhs(booking.totalPesewas)} />
            <Row label="Paid" value={formatGhs(booking.paidPesewas)} />
            <Row label="Balance" value={formatGhs(booking.balancePesewas)} />
          </dl>

          {payments.length > 0 ? (
            <ul className="mt-4 divide-y divide-line border-t border-line pt-1">
              {payments.map((payment) => (
                <li key={payment.reference} className="flex items-baseline justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-body-sm font-medium capitalize text-ink">
                      {payment.status.replace('_', ' ')}
                    </p>
                    <p className="truncate text-caption text-muted">{payment.reference}</p>
                  </div>
                  <span className="tabular shrink-0 text-body-sm text-ink">
                    {formatGhs(payment.amountPesewas)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 border-t border-line pt-4 text-body-sm text-muted">
              No payment yet. The deposit holds the car; the balance is settled at handover.
            </p>
          )}
        </section>

        {/* ── Actions ── */}
        <div className="grid gap-2">
          {awaitingDeposit ? (
            <PayDepositButton bookingRef={booking.ref} amountPesewas={booking.depositDuePesewas} />
          ) : null}
          {cancellable ? <CancelButton bookingRef={booking.ref} /> : null}
          <Link href={rental ? '/rent' : '/book'} className="btn btn-secondary">
            {rental ? 'Hire another car' : 'Book another ride'}
          </Link>
        </div>

        <p className="text-center text-caption text-muted">
          Need to change something? Reply to the WhatsApp confirmation and the team will handle it.
        </p>
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="shrink-0 text-body-sm text-muted">{label}</dt>
      <dd className="text-right text-body-sm font-medium text-ink">{value}</dd>
    </div>
  );
}

function formatDay(day: string): string {
  const date = new Date(`${day}T09:00:00Z`);
  if (Number.isNaN(date.getTime())) return day;

  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Accra',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(date);
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
