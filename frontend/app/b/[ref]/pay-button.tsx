'use client';

import { useState } from 'react';
import { api, ApiError, formatGhs } from '@/lib/api';

/** Resume a deposit from the manage page — the quote link may have expired. */
export function PayDepositButton({ bookingRef, amountPesewas }: { bookingRef: string; amountPesewas: number }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    setBusy(true);
    setError(null);
    try {
      const payment = await api.initializePayment({ bookingRef });
      if (payment.authorizationUrl) {
        window.location.href = payment.authorizationUrl;
        return;
      }
      setError('Could not open the payment page. Please retry.');
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not start the payment');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void pay()}>
        {busy ? 'Opening checkout…' : `Pay deposit ${formatGhs(amountPesewas)}`}
      </button>
      {error ? (
        <p className="mt-2 rounded-input bg-danger-bg px-3 py-2.5 text-body-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}
