/**
 * The four things a customer is actually deciding on, set as an index rather
 * than four cards — rules and numerals keep the page from turning into a grid
 * of boxes.
 */
const PROMISES = [
  {
    title: 'One fixed price',
    body: 'Tolls included, no surge, no meter. The number you are quoted is the number you pay.',
  },
  {
    title: 'Inspected weekly',
    body: 'Every car is on a service plan and checked before it goes out.',
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

export function ProofStrip() {
  return (
    <section className="app-shell section" aria-label="What we promise">
      <ul className="grid gap-x-10 gap-y-8 border-t border-line pt-8 md:grid-cols-2 lg:grid-cols-4">
        {PROMISES.map((promise, index) => (
          <li
            key={promise.title}
            className="lg:border-l lg:border-line lg:pl-10 lg:first:border-l-0 lg:first:pl-0"
          >
            <span className="numeral">{String(index + 1).padStart(2, '0')}</span>
            <h2 className="mt-2 text-body-lg font-semibold text-ink">{promise.title}</h2>
            <p className="mt-1.5 text-body-sm text-muted">{promise.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
