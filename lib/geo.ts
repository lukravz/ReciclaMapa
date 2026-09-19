import type { Coordinates, Point } from '../types/index.ts';

export function isCoordinate(value: unknown): value is Coordinates {
  const p = value as Coordinates | null;
  return !!p && Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;
}
export function calculateDistance(a: Coordinates, b: Coordinates): number {
  if (!isCoordinate(a) || !isCoordinate(b)) throw new Error('Coordenadas inválidas.');
  const rad = Math.PI / 180;
  const h = Math.sin((b.lat - a.lat) * rad / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin((b.lng - a.lng) * rad / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}
export function calculateRouteDistance(points: Coordinates[]): number {
  return points.slice(1).reduce((sum, p, i) => sum + calculateDistance(points[i], p), 0);
}
export function sortPointsByNearestNeighbor<T extends Coordinates>(points: T[], start?: Coordinates, end?: Coordinates): T[] {
  if (points.length < 2) return [...points];
  const remaining = [...points], result: T[] = [];
  let current = start ?? remaining.shift()!;
  if (!start) result.push(current as T);
  while (remaining.length) {
    let closest = 0;
    for (let i = 1; i < remaining.length; i++) if (calculateDistance(current, remaining[i]) < calculateDistance(current, remaining[closest])) closest = i;
    current = remaining.splice(closest, 1)[0]; result.push(current as T);
  }
  const distance = (list: T[]) => calculateRouteDistance([...(start ? [start] : []), ...list, ...(end ? [end] : [])]);
  return distance(result) <= distance(points) ? result : [...points];
}
export function approximateCoordinates(p: Coordinates): Coordinates {
  return { lat: Math.round(p.lat * 100) / 100, lng: Math.round(p.lng * 100) / 100 };
}
/** Residential precision stays in local storage, never in public markers or external routing requests. */
export function visibleLocation(p: Point): Coordinates { return p.type === 'Residência' ? approximateCoordinates(p) : { lat: p.lat, lng: p.lng }; }
export function hasDefinedLocation(p: Point): boolean { return isCoordinate(p) && p.coordinateKind !== 'schematic' && p.locationConfirmed === true; }
export function inRadius(point: Point, origin: Coordinates, radiusKm: number): boolean {
  return hasDefinedLocation(point) && calculateDistance(origin, visibleLocation(point)) <= radiusKm;
}
