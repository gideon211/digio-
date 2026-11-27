'use client';

import Image from 'next/image';
import { BRANDS } from '@/features/landing/model/landing-copy';
import { BrandMarquee } from '@/features/landing/marquee/brand-marquee';
import { Parallax } from '@/shared/motion/parallax/parallax';
import { Reveal } from '@/shared/ui/reveal/reveal';

/**
 * The band that introduces the brand names.
 *
 * The photograph is masked from both sides with hard diagonal gradients so
 * the copy sits on a dark wedge rather than on top of the cars, which is what
 * keeps the white text legible without dimming the whole image.
 *
 * The copy is pinned to the top and the brand strip to the bottom of a fixed
 * height band, because the strip is a rolling edge that the photograph runs
 * into. Letting the two flow together would collapse the band to the height
 * of the copy and lose the composition.
 */
export function BrandsBand() {
  return (
    <section id="about" className="relative isolate h-[800px] overflow-hidden bg-white">
      <Parallax className="absolute -inset-y-24 inset-x-0 -z-10" distance={36}>
        <div className="relative h-full w-full">
          <Image src="/img/brands-band.png" alt="" fill sizes="100vw" className="object-cover" />
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              backgroundImage:
                'linear-gradient(-7.77deg, rgba(0,0,0,1) 3.51%, rgba(0,0,0,0) 35.11%), linear-gradient(129.95deg, rgba(0,0,0,1) 5.27%, rgba(0,0,0,0) 35.33%)',
            }}
          />
        </div>
      </Parallax>

      <div className="absolute inset-x-6 top-8 flex flex-col gap-4 text-center text-white lg:inset-x-auto lg:left-8 lg:w-[537px] lg:text-left">
        <Reveal distance={24}>
          <h2 className="font-display text-[48px] font-bold leading-[56px] tracking-[-0.24px] lg:text-[56px] lg:leading-[64px] lg:tracking-[-0.56px]">
            {BRANDS.title}
          </h2>
        </Reveal>
        <Reveal distance={24} delay={0.06}>
          <p className="max-w-[447px] text-lg leading-7">{BRANDS.body}</p>
        </Reveal>
      </div>

      <div className="absolute inset-x-0 bottom-0 pb-12 pt-8">
        <BrandMarquee />
      </div>
    </section>
  );
}
