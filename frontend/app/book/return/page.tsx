'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { api, ApiError, formatGhs, type Booking, type Payment } from '@/lib/api';

const POLL_INTERVAL_MS = 3000;
const MAX_ATTEMPTS = 40;

export default function PaymentReturnPage() {
  return (
    <Suspense fallback={<Shell>Checking your payment…</Shell>}>
      <PaymentReturn />
    </Suspense>
  );
}

function PaymentReturn() {
  const reference = useSearchParams().get('reference');
  const [payment, setPayment] = useState<Payment | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    if (!reference) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function poll(attempt: number) {
      try {
        const result = await api.getPayment(reference as string);
        if (cancelled) return;
        setPayment(result);
        setAttempts(attempt);

        if (result.status === 'succeeded') {
          const details = await api.getBooking(result.bookingRef).catch(() => null);
          if (!cancelled) setBooking(details);
          return;
        }

        if (result.status === 'failed' || attempt >= MAX_ATTEMPTS) return;
      } catch (cause) {
        if (cancelled) return;
        setError(cause instanceof ApiError ? cause.message : 'Could not read the payment');
        return;
      }

      timer = setTimeout(() => void poll(attempt + 1), POLL_INTERVAL_MS);
    }

    void poll(0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [reference]);

  if (!reference) {
    return (
      <Shell title="Nothing to check">
        <p className="text-[13px] text-muted">
          This page expects a payment reference. Start a booking to get one.
        </p>
        <Link href="/book" className="btn-secondary mt-3">
          Book a ride
        </Link>
      </Shell>
    );
  }

  if (payment?.status === 'succeeded') {
    return (
      <Shell title="Deposit received">
        <dl className="grid gap-2 text-sm">
          <Row label="Reference" value={payment.bookingRef} strong />
          <Row label="Paid" value={formatGhs(payment.amountPesewas)} />
          {booking ? <Row label="Balance" value={formatGhs(booking.balancePesewas)} /> : null}
        </dl>
        <p className="mt-3 text-xs text-muted">
          Your confirmation is on its way by WhatsApp and SMS. Keep the reference for the driver.
        </p>
        <Link href={`/b/${payment.bookingRef}`} className="btn-primary mt-3">
          Manage this booking
        </Link>
      </Shell>
    );
  }

  if (payment?.status === 'failed') {
    return (
      <Shell title="Payment did not go through">
        <p className="text-[13px] text-muted">
          Nothing was charged. You can try again with mobile money or a card.
        </p>
        <Link href={`/b/${payment.bookingRef}`} className="btn-secondary mt-3">
          Retry from the booking
        </Link>
      </Shell>
    );
  }

  if (error) {
    return (
      <Shell title="We lost the thread">
        <p className="rounded-[10px] bg-danger-bg px-3 py-2 text-[13px] text-danger">{error}</p>
        <Link href="/" className="btn-secondary mt-3">
          Back to home
        </Link>
      </Shell>
    );
  }

  const timedOut = attempts >= MAX_ATTEMPTS;

  return (
    <Shell title={timedOut ? 'Still waiting' : 'Confirming your deposit'}>
      <p className="text-[13px] text-muted">
        {timedOut
          ? 'Your mobile money approval has not come through yet. The booking stays valid — we will message you the moment it clears.'
          : 'If you approved the mobile money prompt, this page updates on its own. Keep it open.'}
      </p>
      <div className="mt-3 flex items-center gap-2">
        <span className="h-2 w-2 animate-pulse rounded-full bg-gold" aria-hidden />
        <span className="tabular text-[13px] text-muted">{payment?.status ?? 'checking…'}</span>
      </div>
      {payment ? (
        <Link href={`/b/${payment.bookingRef}`} className="btn-secondary mt-3">
          Open the booking
        </Link>
      ) : null}
    </Shell>
  );
}

function Shell({
  title = 'Payment',
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="app-shell pt-5">
      <header className="mb-4 flex items-center justify-between">
        <Link href="/" className="font-display text-xl font-bold">
          Digio<span className="text-gold">.</span>
        </Link>
        <span className="text-xs text-muted">Payment</span>
      </header>
      <div className="card">
        <h1 className="font-display text-[22px] leading-tight font-bold">{title}</h1>
        <div className="mt-3">{children}</div>
      </div>
    </main>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={strong ? 'tabular font-display text-lg font-bold' : 'tabular font-semibold'}>
        {value}
      </dd>
    </div>
  );
}
