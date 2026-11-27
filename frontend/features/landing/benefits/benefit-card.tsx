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
 * On hover the photograph creeps in and the copy panel turns ink with white
 * text, which is the frame's hover variant. The panel sits under the
 * photograph rather than over it, so the white top half of the card stays
 * white and only the text band darkens.
 */
export function BenefitCard({ card }: BenefitCardProps) {
  return (
    <article className="group flex aspect-[256/290] flex-col overflow-hidden rounded-tile border border-line bg-white">
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <Image
          src={card.image}
          alt={card.alt}
          fill
          sizes="(max-width: 768px) 80vw, 25vw"
          className="object-cover transition-transform duration-[560ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.07] motion-reduce:transition-none"
        />
      </div>
      <div className="flex flex-col justify-center gap-4 p-4 transition-colors duration-[560ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:bg-ink motion-reduce:transition-none">
        <h3 className="font-display text-display-md font-semibold transition-colors duration-[560ms] group-hover:text-white motion-reduce:transition-none">
          {card.title}
        </h3>
        <p className="text-body-md text-ink/72 transition-colors duration-[560ms] group-hover:text-white motion-reduce:transition-none">
          {card.body}
        </p>
      </div>
    </article>
  );
}
