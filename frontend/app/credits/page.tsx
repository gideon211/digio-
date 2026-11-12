import Link from 'next/link';

export const metadata = {
  title: 'Image credits',
  description: 'Sources and licences for the vehicle photography used on this site.',
};

const PHOTOS = [
  {
    subject: 'Toyota Camry (XV70)',
    used: 'Executive Sedan',
    author: 'Dinkun Chen',
    licence: 'CC BY-SA 4.0',
    href: 'https://commons.wikimedia.org/wiki/File:TOYOTA_CAMRY_(XV70)_China_(42).jpg',
  },
  {
    subject: 'Toyota Land Cruiser Prado (J250)',
    used: 'Premium SUV',
    author: 'Retired electrician',
    licence: 'CC0 1.0',
    href: 'https://commons.wikimedia.org/wiki/File:Moscow,_Toyota_Land_Cruiser_Prado_(J250)_July_2026_01.jpg',
  },
  {
    subject: 'Toyota HiAce 3.0 GL Grandia',
    used: 'Executive Van',
    author: 'Ethan Llamas',
    licence: 'CC BY-SA 4.0',
    href: 'https://commons.wikimedia.org/wiki/File:2018_Toyota_Hiace_3.0_GL_Grandia_in_Black_Mica,_01-20-2024.jpg',
  },
] as const;

/**
 * A plain, honest credits page. Two photographs are CC0 and need nothing; the
 * van is CC BY-SA, so the author and licence are named and linked rather than
 * buried in a repository file.
 */
export default function CreditsPage() {
  return (
    <main className="app-shell pt-10 pb-16 md:pb-24">
      <div className="stack">
        <p className="eyebrow">Credits</p>
        <h1 className="mt-2 font-display text-display-lg text-ink">Image credits.</h1>
        <p className="mt-3 text-body-sm text-muted">
          The fleet photographs come from Wikimedia Commons. One is public domain; two are shared
          under CC BY-SA 4.0, so their authors are credited below.
        </p>

        <ul className="mt-6 border-t border-line">
          {PHOTOS.map((photo) => (
            <li key={photo.subject} className="border-b border-line py-4">
              <p className="text-body-md font-semibold text-ink">{photo.used}</p>
              <p className="mt-0.5 text-body-sm text-muted">{photo.subject}</p>
              <p className="mt-1 text-caption text-muted">
                {photo.author} · {photo.licence} ·{' '}
                <a
                  href={photo.href}
                  rel="noreferrer noopener"
                  target="_blank"
                  className="text-forest underline underline-offset-4"
                >
                  source
                </a>
              </p>
            </li>
          ))}
        </ul>

        <Link
          href="/"
          className="mt-6 inline-block text-body-sm font-medium text-forest underline-offset-4 hover:underline"
        >
          ← Back to Digio
        </Link>
      </div>
    </main>
  );
}
