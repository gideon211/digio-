import { BenefitsSection } from '../features/landing/benefits/benefits-section';
import { BookingStepsSection } from '../features/landing/steps/booking-steps-section';
import { BrandsBand } from '../features/landing/brands/brands-section';
import { CtaSection } from '../features/landing/cta/cta-section';
import { FaqSection } from '../features/landing/faq/faq-section';
import { FleetSection } from '../features/landing/fleet/fleet-section';
import { SiteFooter } from '../features/landing/footer/site-footer';
import { Hero } from '../features/landing/hero/hero';
import { MobileHeader } from '../features/landing/header/mobile-header';
import { ShowcaseSection } from '../features/landing/showcase/showcase-section';

export default function HomePage() {
  return (
    <main id="top" className="bg-ink">
      <MobileHeader />
      <Hero />
      <BrandsBand />
      <BenefitsSection />
      <FleetSection />
      <BookingStepsSection />
      <ShowcaseSection />
      <FaqSection />
      <CtaSection />
      <SiteFooter />
    </main>
  );
}
