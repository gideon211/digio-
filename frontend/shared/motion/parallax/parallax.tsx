'use client';

import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { useRef, type ReactNode } from 'react';

interface ParallaxProps {
  children: ReactNode;
  className?: string;
  distance?: number;
}

/**
 * Drifts its child against the scroll direction.
 *
 * The transform is driven straight from scroll progress rather than through a
 * spring. A spring needs its own animation loop on every scroll frame and
 * keeps running after scrolling stops, which is a lot of work to hide a
 * movement this small. The wrapper is marked `will-change: transform` so the
 * large image stays on its own compositor layer and the browser never
 * repaints it while it drifts.
 *
 * Screens using the wrapper must give it more height than the image so the
 * drift never exposes an edge.
 *
 * Reduced-motion visitors get the same element and layout with a zero travel,
 * which is why the preference changes the transform range rather than the
 * markup. Swapping the markup would make the server and client disagree.
 */
export function Parallax({ children, className, distance = 48 }: ParallaxProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const travel = reduced ? 0 : distance;
  const y = useTransform(scrollYProgress, [0, 1], [travel, -travel]);

  return (
    <div ref={ref} className={className}>
      <motion.div className="h-full w-full will-change-transform" style={{ y }}>
        {children}
      </motion.div>
    </div>
  );
}
