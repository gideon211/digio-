import type { Metadata, Viewport } from 'next';
import { Kameron, Outfit } from 'next/font/google';
import { MotionProvider } from '@/shared/motion/config/motion-config';
import { PageLoader } from '@/shared/ui/page-loader/page-loader';
import './globals.css';

/*
 * Kameron and Outfit are both variable fonts on Google Fonts, so the whole
 * weight range arrives in one file and the browser interpolates between the
 * weights the design actually uses rather than downloading a separate file
 * per weight.
 */
const kameron = Kameron({
  subsets: ['latin'],
  weight: 'variable',
  variable: '--font-kameron',
  display: 'swap',
});

const outfit = Outfit({
  subsets: ['latin'],
  weight: 'variable',
  variable: '--font-outfit',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Digio | Luxury Rides, Just a Tap Away',
    template: '%s · Digio',
  },
  description:
    'Ride in comfort and style with premium vehicles and professional chauffeurs, whenever and wherever you need them.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#181818',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${kameron.variable} ${outfit.variable}`}>
      <body>
        <MotionProvider>
          <PageLoader />
          {children}
        </MotionProvider>
      </body>
    </html>
  );
}
