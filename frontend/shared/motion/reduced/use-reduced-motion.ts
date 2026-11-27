'use client';

import { useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';

/**
 * `useReducedMotion` with a stable first render.
 *
 * The media query is unknown on the server, so the hook reports false for the
 * first client render too and only flips after mount. Reading the preference
 * during hydration makes the transform bound on the client disagree with the
 * server markup, which React reports as a hydration mismatch.
 *
 * Use this anywhere the preference changes a style value rather than gating
 * an animation. Animations themselves are already covered by MotionConfig.
 */
export function useSafeReducedMotion() {
  const reduced = useReducedMotion();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return mounted && reduced === true;
}
