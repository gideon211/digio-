'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, ApiError } from '@/lib/api';

export function CancelButton({ bookingRef }: { bookingRef: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    setBusy(true);
    setError(null);
    try {
      await api.cancelBooking(bookingRef);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not cancel the booking');
    } finally {
      setBusy(false);
    }
  }

  if (!confirming) {
    return (
      <button type="button" className="btn btn-secondary" onClick={() => setConfirming(true)}>
        Cancel this booking
      </button>
    );
  }

  return (
    <section className="form-card" role="alertdialog" aria-label={`Cancel ${bookingRef}`}>
      <h2 className="font-display text-display-sm text-ink">Cancel {bookingRef}?</h2>
      <p className="mt-1.5 text-body-sm text-muted">
        The car goes straight back into the fleet. Any deposit already paid is refunded under the
        cancellation policy.
      </p>

      {error ? (
        <p className="mt-3 rounded-input bg-danger-bg px-3 py-2.5 text-body-sm text-danger">
          {error}
        </p>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button type="button" className="btn btn-secondary" onClick={() => setConfirming(false)}>
          Keep it
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy}
          onClick={() => void cancel()}
        >
          {busy ? 'Cancelling…' : 'Cancel booking'}
        </button>
      </div>
    </section>
  );
}
