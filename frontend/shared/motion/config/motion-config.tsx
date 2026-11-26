'use client';

import { MotionConfig } from 'motion/react';
import type { ReactNode } from 'react';

interface MotionProviderProps {
  children: ReactNode;
}

/**
 * Applies the visitor's reduced-motion preference to every animation below.
 *
 * Motion drops transform and layout animations when the preference is on and
 * keeps the opacity fades, so the page still communicates state without
 * moving anything across the screen. Centralising it here means individual
 * sections never need to branch on the preference.
 */
export function MotionProvider({ children }: MotionProviderProps) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
