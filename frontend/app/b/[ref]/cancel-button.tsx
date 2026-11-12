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
      <button type="button" className="btn-secondary" onClick={() => setConfirming(true)}>
        Cancel this booking
      </button>
    );
  }

  return (
    <div className="card">
      <p className="text-[13px] font-semibold">Cancel {bookingRef}?</p>
      <p className="mt-1 text-xs text-muted">
        Any deposit already paid is refunded under the cancellation policy.
      </p>
      {error ? <p className="mt-2 text-[13px] text-danger">{error}</p> : null}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" className="btn-secondary" onClick={() => setConfirming(false)}>
          Keep it
        </button>
        <button
          type="button"
          className="btn-primary"
          disabled={busy}
          onClick={() => void cancel()}
        >
          {busy ? 'Cancelling…' : 'Cancel'}
        </button>
      </div>
    </div>
  );
}
