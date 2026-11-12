/**
 * Pure spherical geometry for trip playback. No I/O, no clock, no database —
 * the same rule the pricing engine follows: keep the maths testable.
 *
 * Coordinates are GeoJSON order: [longitude, latitude].
 */
export type LngLat = [number, number];

const EARTH_RADIUS_M = 6_371_008.8;
const DEG_TO_RAD = Math.PI / 180;

/** Great-circle distance in metres. */
export function distanceMetres(a: LngLat, b: LngLat): number {
  const lat1 = a[1] * DEG_TO_RAD;
  const lat2 = b[1] * DEG_TO_RAD;
  const dLat = (b[1] - a[1]) * DEG_TO_RAD;
  const dLng = (b[0] - a[0]) * DEG_TO_RAD;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial bearing from `a` to `b`, degrees clockwise from true north. */
export function bearing(a: LngLat, b: LngLat): number {
  const lat1 = a[1] * DEG_TO_RAD;
  const lat2 = b[1] * DEG_TO_RAD;
  const dLng = (b[0] - a[0]) * DEG_TO_RAD;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (Math.atan2(y, x) / DEG_TO_RAD + 360) % 360;
}

/** Running totals: `result[i]` is the metres from the start to point `i`. */
export function cumulativeLengths(points: LngLat[]): number[] {
  const totals: number[] = new Array(points.length);
  let total = 0;
  for (let i = 0; i < points.length; i += 1) {
    if (i > 0) total += distanceMetres(points[i - 1], points[i]);
    totals[i] = total;
  }
  return totals;
}

export interface RouteSample {
  position: LngLat;
  heading: number;
}

/** The point `metres` along the polyline, plus the bearing of the segment it sits on. */
export function interpolate(points: LngLat[], cumulative: number[], metres: number): RouteSample {
  if (points.length === 0) throw new Error('interpolate: route is empty');
  const total = cumulative[cumulative.length - 1] ?? 0;
  if (points.length === 1 || total <= 0) {
    return { position: points[0], heading: points.length > 1 ? bearing(points[0], points[1]) : 0 };
  }

  const clamped = Math.max(0, Math.min(metres, total));
  let index = 1;
  while (index < cumulative.length - 1 && cumulative[index] < clamped) index += 1;

  const segmentStart = cumulative[index - 1];
  const segmentLength = cumulative[index] - segmentStart;
  const t = segmentLength <= 0 ? 0 : (clamped - segmentStart) / segmentLength;
  const from = points[index - 1];
  const to = points[index];

  return {
    position: [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t],
    heading: bearing(from, to),
  };
}

/**
 * How far along the polyline `point` is: the nearest segment, projected in a
 * local flat frame (accurate at Accra city scale). Used to resume playback
 * from wherever the car actually is after a restart.
 */
export function projectOnRoute(point: LngLat, points: LngLat[], cumulative: number[]): number {
  if (points.length < 2) return 0;

  const cosLat = Math.cos(point[1] * DEG_TO_RAD);
  const toXY = (p: LngLat): [number, number] => [
    (p[0] - point[0]) * DEG_TO_RAD * EARTH_RADIUS_M * cosLat,
    (p[1] - point[1]) * DEG_TO_RAD * EARTH_RADIUS_M,
  ];

  let bestMetres = Number.POSITIVE_INFINITY;
  let bestAlong = 0;

  for (let i = 1; i < points.length; i += 1) {
    const [ax, ay] = toXY(points[i - 1]);
    const [bx, by] = toXY(points[i]);
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSquared = dx * dx + dy * dy;
    let t = lengthSquared === 0 ? 0 : -(ax * dx + ay * dy) / lengthSquared;
    t = Math.max(0, Math.min(1, t));

    const d = Math.hypot(ax + t * dx, ay + t * dy);
    if (d < bestMetres) {
      bestMetres = d;
      bestAlong = cumulative[i - 1] + t * (cumulative[i] - cumulative[i - 1]);
    }
  }

  return bestAlong;
}

/** Index of the route point closest to `point`. */
export function nearestIndex(point: LngLat, points: LngLat[]): number {
  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let i = 0; i < points.length; i += 1) {
    const d = distanceMetres(point, points[i]);
    if (d < bestDistance) {
      bestDistance = d;
      best = i;
    }
  }
  return best;
}

/**
 * Drop intermediate points closer than `spacingMetres` to the last kept one —
 * an OSRM `overview=full` polyline is far denser than a map needs, and every
 * point costs a row. The two ends are always kept.
 */
export function decimate(points: LngLat[], spacingMetres: number): LngLat[] {
  if (points.length <= 2) return points.slice();

  const kept: LngLat[] = [points[0]];
  for (let i = 1; i < points.length - 1; i += 1) {
    if (distanceMetres(kept[kept.length - 1], points[i]) >= spacingMetres) kept.push(points[i]);
  }

  const last = points[points.length - 1];
  const keptLast = kept[kept.length - 1];
  if (keptLast[0] !== last[0] || keptLast[1] !== last[1]) kept.push(last);
  return kept;
}

/** Offline fallback: the trip still tracks when OSRM cannot be reached. */
export function straightLine(from: LngLat, to: LngLat): LngLat[] {
  return [from, to];
}

/** Six decimal places — roughly 0.11 m, finer than any GPS fix we receive. */
export function roundLngLat(point: LngLat): LngLat {
  return [Math.round(point[0] * 1e6) / 1e6, Math.round(point[1] * 1e6) / 1e6];
}
