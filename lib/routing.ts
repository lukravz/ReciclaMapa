import { hasDefinedLocation, sortPointsByNearestNeighbor, visibleLocation } from './geo.ts';
import type { Coordinates, Point, RoadRoute, RouteComparison } from '../types/index.ts';
export function routeFingerprint(points: Point[], start: Coordinates, end?: Coordinates): string {
  return JSON.stringify({ points: points.map(p => [p.id, ...Object.values(visibleLocation(p))]), start: {lat:start.lat,lng:start.lng}, end: end ? {lat:end.lat,lng:end.lng} : null });
}
export async function fetchRoadRoute(coordinates: Coordinates[], signal?: AbortSignal): Promise<RoadRoute> {
  const request = () => fetch('/api/route', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ coordinates }), signal });
  let response = await request();
  // A comparison can hit the shared provider interval on its second request.
  // Retry once after that interval; never bypass the server's rate limit.
  if (response.status === 429) {
    await new Promise<void>((resolve, reject) => {
      if (signal?.aborted) return reject(new DOMException('Cancelado', 'AbortError'));
      const abort = () => { clearTimeout(timer); reject(new DOMException('Cancelado', 'AbortError')); };
      const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, 2000);
      signal?.addEventListener('abort', abort, {once:true});
    });
    response = await request();
  }
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? 'Não foi possível calcular a rota agora. Tente novamente.');
  return result;
}
export async function compareRoutes(points: Point[], start: Coordinates, end?: Coordinates, signal?: AbortSignal): Promise<RouteComparison> {
  if (!points.length || points.length > 20) throw new Error('Selecione entre 1 e 20 pontos por rota neste MVP.');
  if (points.some(p => !hasDefinedLocation(p))) throw new Error('Confirme a localização dos pontos antigos antes de calcular a rota.');
  const safePoints = points.map(p => ({ ...p, ...visibleLocation(p) }));
  const ordered = sortPointsByNearestNeighbor(safePoints, start, end);
  const path = (list: Point[]) => [start, ...list.map(p => ({lat:p.lat,lng:p.lng})), ...(end ? [end] : [])];
  const original = await fetchRoadRoute(path(safePoints), signal);
  const sameOrder = ordered.every((p, i) => p.id === points[i].id);
  const candidate = sameOrder ? original : await fetchRoadRoute(path(ordered), signal);
  // Proximity can worsen the driving distance because streets are directed. Compare real road results.
  const improves = candidate.distanceKm <= original.distanceKm;
  return { original, suggested: improves ? candidate : original, originalIds: points.map(p => p.id), suggestedIds: (improves ? ordered : points).map(p => p.id), start, end, approximateResidential: points.some(p => p.type === 'Residência'), fingerprint: routeFingerprint(points, start, end) };
}

