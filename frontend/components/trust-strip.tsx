/**
 * The four things a customer is actually deciding on. Kept out of the hero so
 * the headline stays a headline.
 */
const PROMISES = [
  {
    title: 'One fixed price',
    body: 'Tolls included, no surge, no meter. The number you are quoted is the number you pay.',
  },
  {
    title: 'Inspected weekly',
    body: 'Every car is serviced on a schedule and checked before it goes out.',
  },
  {
    title: 'Documents tracked',
    body: 'Licences and roadworthiness certificates are held with expiry dates, not trusted to memory.',
  },
  {
    title: '30% today, rest later',
    body: 'A deposit confirms the booking. The balance is settled at handover, not before.',
  },
] as const;

export function TrustStrip() {
  return (
    <section className="mt-6 border-y border-line py-6 md:mt-8 md:py-8" aria-label="What we promise">
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {PROMISES.map((promise) => (
          <div key={promise.title}>
            <h2 className="text-body-md font-semibold text-ink">{promise.title}</h2>
            <p className="mt-1.5 text-body-sm text-muted">{promise.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
