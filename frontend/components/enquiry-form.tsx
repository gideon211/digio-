'use client';

import { useState } from 'react';
import { api, ApiError } from '@/lib/api';

const KINDS = [
  { value: 'corporate', label: 'Corporate account' },
  { value: 'wedding', label: 'Wedding or event' },
  { value: 'long_term', label: 'Long-term hire' },
  { value: 'jet', label: 'Private jet' },
  { value: 'yacht', label: 'Yacht' },
] as const;

type Kind = (typeof KINDS)[number]['value'];

/**
 * Anything we cannot price online goes here. No instant quote, no false
 * promise of one — it records the contact and says so plainly.
 */
export function EnquiryForm() {
  const [kind, setKind] = useState<Kind>('corporate');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await api.sendEnquiry({
        kind,
        name,
        phone,
        email: email || undefined,
        message: message || undefined,
      });
      setReference(result.id.slice(0, 8).toUpperCase());
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not send that — try again');
    } finally {
      setBusy(false);
    }
  }

  if (reference) {
    return (
      <div className="form-card self-start" role="status">
        <span className="chip chip-gold">Enquiry {reference}</span>
        <h3 className="mt-3 font-display text-display-md text-ink">We have it.</h3>
        <p className="mt-2 text-body-sm text-muted">
          A person will call the number you gave us to talk through the numbers.
        </p>

        <ul className="mt-4 grid gap-2.5 border-t border-line pt-4 text-body-sm text-muted">
          {[
            'You get a call on the number you gave, not a bot.',
            'The quote comes in writing, with the fleet listed.',
            'Nothing is charged until you say go.',
          ].map((line) => (
            <li key={line} className="flex gap-3">
              <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <form className="form-card self-start" onSubmit={(event) => void submit(event)}>
      <h3 className="font-display text-display-sm text-ink">Tell us what you need</h3>

      <fieldset className="mt-4">
        <legend className="label">Type of enquiry</legend>
        <div className="flex flex-wrap gap-2">
          {KINDS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={kind === option.value}
              onClick={() => setKind(option.value)}
              className={`chip cursor-pointer transition-colors ${
                kind === option.value
                  ? 'border-forest bg-forest text-hero-ink'
                  : 'hover:border-line-strong'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="field">
          <span className="field-label">Name</span>
          <input
            className="field-control"
            required
            minLength={2}
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className="field">
          <span className="field-label">Mobile number</span>
          <input
            className="field-control tabular"
            required
            inputMode="tel"
            autoComplete="tel"
            placeholder="024 123 4567"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
        </label>
      </div>

      <div className="mt-3 grid gap-3">
        <label className="field">
          <span className="field-label">Email (optional)</span>
          <input
            className="field-control"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label className="field">
          <span className="field-label">What are you planning?</span>
          <textarea
            className="field-control resize-y"
            rows={3}
            placeholder="Six staff, every Tuesday and Thursday, airport to Ridge."
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />
        </label>
      </div>

      {error ? (
        <p className="mt-3 rounded-input bg-danger-bg px-3 py-2.5 text-body-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <button className="btn btn-primary mt-4" type="submit" disabled={busy}>
        {busy ? 'Sending…' : 'Send the enquiry'}
      </button>
      <p className="mt-3 text-caption text-muted">
        We use your number to reply about this enquiry only.
      </p>
    </form>
  );
}
