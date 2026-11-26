import Image from 'next/image';
import type { BenefitCard as BenefitCardModel } from '@/features/landing/model/landing-copy';

interface BenefitCardProps {
  card: BenefitCardModel;
}

/**
 * One of the four reasons-to-book cards.
 *
 * The photograph is cropped to a fixed height and the text block beneath it
 * takes the rest, so a card is a fixed square regardless of how long the
 * copy runs. The design does the same thing, which is why the four cards
 * line up even though their descriptions differ in length.
 *
 * The card lifts and the photograph creeps in slightly on hover. Both are
 * transforms, so nothing reflows and the four cards stay on one line.
 */
export function BenefitCard({ card }: BenefitCardProps) {
  return (
    <article className="group flex aspect-[256/290] flex-col overflow-hidden rounded-tile border border-line bg-white transition-transform duration-500 ease-out hover:-translate-y-1.5">
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <Image
          src={card.image}
          alt={card.alt}
          fill
          sizes="(max-width: 768px) 80vw, 25vw"
          className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06]"
        />
      </div>
      <div className="flex flex-col justify-center gap-4 p-4">
        <h3 className="font-display text-display-md font-semibold">{card.title}</h3>
        <p className="text-body-md text-ink/72">{card.body}</p>
      </div>
    </article>
  );
}
