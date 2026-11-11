import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, DM_Sans } from 'next/font/google';
import './globals.css';

const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  weight: ['500', '700'],
  variable: '--font-bricolage',
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-dm-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Digio — Arrive well. Every ride.',
  description:
    'Late-model cars, vetted chauffeurs, one fixed price. Airport transfers, chauffeur hire and self-drive rentals in Accra.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0f3d2e',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GH" className={`${bricolage.variable} ${dmSans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
