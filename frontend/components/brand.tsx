import Link from 'next/link';

export function Brand({ className = '' }: { className?: string }) {
  return (
    <Link
      href="/"
      className={`font-display text-xl font-bold tracking-tight text-ink ${className}`}
      aria-label="Digio home"
    >
      Digio<span className="text-gold">.</span>
    </Link>
  );
}
