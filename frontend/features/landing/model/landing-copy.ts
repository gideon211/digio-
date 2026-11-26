/**
 * Every string on the landing page, in one place.
 *
 * The copy is a business asset, not a layout detail: it is what the sales team
 * edits when a campaign changes. Keeping it out of the components means a copy
 * change never touches a component and a component change never risks the copy.
 */

export interface NavLink {
  label: string;
  href: string;
}

export const NAV_LINKS: NavLink[] = [
  { label: 'Home', href: '/' },
  { label: 'Our Fleet', href: '#fleet' },
  { label: 'About Us', href: '#about' },
  { label: 'Contact Us', href: '#contact' },
];

export const HERO = {
  title: 'Luxury Rides, Just a Tap Away.',
  body: 'Ride in comfort and style with premium vehicles and professional chauffeurs, whenever and wherever you need them.',
  primaryCta: 'Book a Ride',
  secondaryCta: 'Explore our Services',
} as const;

export interface HeroStat {
  value: string;
  label: string;
  /** The five star is an icon rather than a character so it inherits the stroke. */
  showStar?: boolean;
}

export const HERO_STATS: HeroStat[] = [
  { value: '5', label: 'Premium Experience', showStar: true },
  { value: 'VIP', label: 'Luxury Service' },
  { value: '24/7', label: 'Ride Booking' },
  { value: 'Swift', label: 'Prompt arrivals.' },
];

export const BRANDS = {
  title: 'We Bring Luxury to Every Ride.',
  body: "We help you book premium rides from the world's finest car brands, making every journey exceptional.",
} as const;

export const BENEFITS = {
  title: 'The Luxury Ride You Deserve.',
  body: 'More than just a ride. Experience premium vehicles, effortless bookings and exceptional comfort wherever you go.',
} as const;

export interface BenefitCard {
  title: string;
  body: string;
  image: string;
  alt: string;
}

export const BENEFIT_CARDS: BenefitCard[] = [
  {
    title: 'Premium Fleet',
    body: "Choose from an exclusive selection of the world's finest luxury vehicles.",
    image: '/img/card-premium-fleet.png',
    alt: 'A row of dark luxury cars parked in a showroom',
  },
  {
    title: 'Effortless Booking',
    body: 'Book your preferred luxury ride in just a few taps, whenever you need it.',
    image: '/img/card-effortless.png',
    alt: 'A hand holding a car key beside a vehicle',
  },
  {
    title: 'First-Class Comfort',
    body: 'Enjoy every journey with exceptional comfort and professional service.',
    image: '/img/card-comfort.png',
    alt: 'The quilted leather interior of a luxury saloon',
  },
  {
    title: 'Swift Pickups',
    body: 'Enjoy prompt pickups and reliable arrivals, getting you to your destination without unnecessary delays.',
    image: '/img/card-swift.png',
    alt: 'A chauffeur waiting beside an open car door at night',
  },
];

export interface FleetSlide {
  title: string;
  body: string;
  cta: string;
  image: string;
  alt: string;
}

export const FLEET_SLIDES: FleetSlide[] = [
  {
    title: 'Explore Our Luxury Fleet',
    body: 'Discover an exclusive collection of premium vehicles, carefully selected to make every journey comfortable, stylish and exceptional.',
    cta: 'Browse All Cars',
    image: '/img/fleet-1.png',
    alt: 'A dark saloon photographed from a low angle',
  },
  {
    title: 'Premium Selection',
    body: 'From elegant sedans to commanding SUVs, discover vehicles that match your style and expectations.',
    cta: 'View Our Collection',
    image: '/img/fleet-2.png',
    alt: 'A vehicle wheel and brake disc in close detail',
  },
  {
    title: 'Your Perfect Ride',
    body: 'Find the ideal vehicle for every occasion, with exceptional comfort, style and performance.',
    cta: 'Find Your Ride',
    image: '/img/fleet-3.png',
    alt: 'A driver holding a steering wheel inside a cabin',
  },
];

export const STEPS = {
  title: 'How to Book Your Ride',
  body: 'More than just a ride. Experience premium vehicles, effortless bookings and exceptional comfort wherever you go.',
} as const;

export interface BookingStep {
  title: string;
  body: string;
  image: string;
  alt: string;
}

export const BOOKING_STEPS: BookingStep[] = [
  {
    title: 'Choose Your Ride',
    body: 'Browse our luxury fleet and select the vehicle that suits your needs.',
    image: '/img/step-choose.png',
    alt: 'A fleet of cars lined up under studio lighting',
  },
  {
    title: 'Make a Booking',
    body: 'Choose your pickup location, destination, date and preferred time.',
    image: '/img/step-book.png',
    alt: 'A customer completing a booking on a phone',
  },
  {
    title: 'Enjoy Your Ride',
    body: 'Confirm your booking, meet your chauffeur and enjoy a first-class ride.',
    image: '/img/step-enjoy.png',
    alt: 'A chauffeur opening the door of a luxury car',
  },
];

export const SHOWCASE = {
  title: 'Choose Your Next Ride.',
  body: 'From elegant sedans to spacious SUVs, explore a wide range of luxury vehicles and book the ride that suits your plans, style and needs.',
} as const;

export interface FaqEntry {
  question: string;
  answer: string;
}

export const FAQ_ENTRIES: FaqEntry[] = [
  {
    question: 'What is Digio?',
    answer:
      'Digio is a premium mobility service that makes it easy to discover and book luxury vehicles for your personal and travel needs.',
  },
  {
    question: 'How do I book a vehicle?',
    answer:
      'Browse our available vehicles, select your preferred car, choose your booking details and submit your request to get started.',
  },
  {
    question: 'What types of vehicles can I book?',
    answer:
      'You can explore a selection of premium vehicles, including Range Rover, Rolls-Royce, Cadillac Escalade, Mercedes-Benz, BMW and other luxury brands.',
  },
  {
    question: 'Can I book a vehicle with a chauffeur?',
    answer:
      'Yes. You can request a professional chauffeur for a comfortable and convenient travel experience, subject to vehicle and service availability.',
  },
  {
    question: 'Can I book a vehicle for a special occasion?',
    answer:
      'Absolutely. Our vehicles are suitable for weddings, business meetings, airport transfers, vacations, celebrations and other special occasions.',
  },
  {
    question: 'How far in advance should I book?',
    answer:
      'We recommend booking in advance to secure your preferred vehicle and schedule. However, last-minute requests may be accommodated depending on availability.',
  },
  {
    question: 'How will I know if my booking is confirmed?',
    answer:
      'Once your booking request has been reviewed and confirmed, you will receive the relevant booking details and confirmation.',
  },
  {
    question: 'Can I cancel or modify my booking?',
    answer:
      'Yes. You can contact our support team to request changes or cancellations. Applicable terms and conditions may apply.',
  },
];

export const CLOSING = {
  title: 'Ready for Your Next Luxury Ride?',
  body: 'Your perfect ride is just a few clicks away. Choose your vehicle and let Digio take care of the rest.',
  cta: 'Book a Ride',
} as const;

export const FOOTER = {
  body: 'Discover luxury travel with DIGIO. Explore premium vehicles, book effortlessly and enjoy every journey in comfort and style.',
  address: ['123 Example Road, Accra Ghana,', 'GH 12345'],
  email: 'Email: info@digio-car.com',
  phone: 'Phone: (123) 456-7890',
  copyright: '© 2025 Digio-car. All rights reserved.',
  legalLinks: ['Privacy Policy', 'Terms& Conditions'],
} as const;

export const FOOTER_LINKS: NavLink[] = [
  { label: 'Home', href: '/' },
  { label: 'Garage', href: '#fleet' },
  { label: 'About Us', href: '#about' },
  { label: 'Contact Us', href: '#contact' },
];
