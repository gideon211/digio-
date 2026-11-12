'use client';

export interface RibbonStep {
  key: string;
  label: string;
}

/**
 * Progress through a booking. Completed steps turn gold, the current one is
 * forest — the same two colours the buttons use, so the state reads instantly.
 */
export function StepRibbon({
  steps,
  activeKey,
}: {
  steps: readonly RibbonStep[];
  activeKey: string;
}) {
  const found = steps.findIndex((step) => step.key === activeKey);
  // An unknown key means the flow is finished — every step reads as done.
  const activeIndex = found === -1 ? steps.length : found;

  return (
    <ol className="mb-5 flex items-center gap-2" aria-label="Booking progress">
      {steps.map((step, index) => {
        const done = index < activeIndex;
        const current = index === activeIndex;
        return (
          <li key={step.key} className="flex flex-1 items-center gap-2">
            <span
              className={`grid h-6 w-6 shrink-0 place-items-center rounded-pill text-caption font-semibold ${
                current
                  ? 'bg-forest text-hero-ink'
                  : done
                    ? 'bg-gold text-gold-ink'
                    : 'bg-sunken text-muted'
              }`}
              aria-hidden
            >
              {index + 1}
            </span>
            <span
              className={`text-body-sm ${current ? 'font-semibold text-ink' : 'text-muted'}`}
              aria-current={current ? 'step' : undefined}
            >
              {step.label}
            </span>
            {index < steps.length - 1 ? (
              <span className={`h-px flex-1 ${done ? 'bg-gold' : 'bg-line'}`} aria-hidden />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
