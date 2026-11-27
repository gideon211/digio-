/**
 * A short tap pulse, where the platform supports it.
 *
 * The Vibration API is the only haptic channel the web exposes. Android
 * Chrome and Firefox honour it; iOS Safari does not, so this is an extra
 * acknowledgement on top of the visual press state, never the only one.
 *
 * 10ms is the shortest pulse that still reads as a tap on most devices
 * rather than a buzz. One call per click, so rapid taps do not queue into
 * one long vibration.
 */
const TAP_MS = 10;

export function vibrateOnTap() {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  navigator.vibrate(TAP_MS);
}
