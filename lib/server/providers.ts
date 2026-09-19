import { isCoordinate, approximateCoordinates } from '../geo.ts';
import { sharedProviderCall } from './provider-cache';
import { database } from '@/db';
import {checkOrigin,limit,HttpError} from './security';
import type { Coordinates, GeocodingResult, RoadRoute } from '../../types/index.ts';
type Pool = { queue: Promise<void>; last: number; pending: number; cache: Map<string, { expires: number; value: unknown }>; inflight: Map<string, Promise<unknown>> };
const globals = globalThis as typeof globalThis & { reciclaProviders?: Map<string, Pool> };
const pools = globals.reciclaProviders ??= new Map();
function pool(name: string) { if (!pools.has(name)) pools.set(name, {queue: Promise.resolve(), last: 0, pending: 0, cache: new Map(), inflight: new Map()}); return pools.get(name)!; }
export class ProviderError extends Error { constructor(message: string, public status = 503) { super(message); } }
async function cached<T>(provider: string, key: string, ttl: number, execute: () => Promise<T>): Promise<T> {
  const p = pool(provider), entry = p.cache.get(key);
  if (entry && entry.expires > Date.now()) return entry.value as T;
  if (p.inflight.has(key)) return p.inflight.get(key) as Promise<T>;
  if (p.pending >= 8) throw new ProviderError('Muitas consultas em andamento. Aguarde alguns segundos.', 429);
  p.pending++;
  const work = p.queue.then(async () => {
    const pause = Math.max(0, 1100 - (Date.now() - p.last));
    if (pause) await new Promise(resolve => setTimeout(resolve, pause));
    p.last = Date.now();
    const value = await sharedProviderCall(provider,key,ttl,execute);
    if (p.cache.size >= 250) p.cache.delete(p.cache.keys().next().value!);
    p.cache.set(key, { value, expires: Date.now() + ttl });
    return value;
  });
  p.queue = work.then(() => {}, () => {}); p.inflight.set(key, work);
  try { return await work; } finally { p.pending--; p.inflight.delete(key); }
}
async function externalJson(url: URL): Promise<unknown> {
  try {
    const response = await fetch(url, { headers: { 'User-Agent': process.env.GEOCODING_USER_AGENT || 'ReciclaMapa/2.0 (local-MVP)', 'Accept': 'application/json', 'Accept-Language': 'pt-BR,pt;q=0.9' }, signal: AbortSignal.timeout(12000), cache: 'no-store' });
    if (!response.ok) throw new ProviderError(response.status === 429 ? 'Serviço temporariamente limitado. Aguarde e tente novamente.' : 'Serviço de mapas indisponível. Tente novamente ou use o preenchimento manual.', response.status === 429 ? 429 : 503);
    return await response.json();
  } catch (error) { if (error instanceof ProviderError) throw error; throw new ProviderError('Não foi possível consultar o serviço de mapas agora. Verifique a conexão e tente novamente.'); }
}
type NominatimItem = { lat: string; lon: string; display_name: string; address?: Record<string, string> };
function parsePlace(item: NominatimItem, residential: boolean): GeocodingResult {
  const a = item.address ?? {}, position = { lat: Number(item.lat), lng: Number(item.lon) };
  if (!isCoordinate(position)) throw new ProviderError('O serviço não encontrou coordenadas válidas.');
  const region = a.suburb || a.neighbourhood || a.city_district || a.quarter || '';
  const city = a.city || a.town || a.municipality || a.village || '';
  const state = a['ISO3166-2-lvl4']?.replace('BR-', '') || a.state || '';
  return { ...(residential ? approximateCoordinates(position) : position), label: residential ? [region, city, state].filter(Boolean).join(', ') : item.display_name, region, city, state, street: residential ? '' : (a.road || a.pedestrian || ''), number: residential ? '' : (a.house_number || ''), postcode: residential ? '' : (a.postcode || '') };
}
export async function searchAddress(body: Record<string, unknown>): Promise<GeocodingResult[]> {
  const field = (k: string) => typeof body[k] === 'string' ? String(body[k]).trim().slice(0, 150) : '';
  const residential = body.residential === true;
  if (!field('city') || !field('state') || (!field('street') && !field('region'))) throw new ProviderError('Informe endereço ou bairro, cidade e estado.', 400);
  // No names, house numbers or residential streets are sent for private homes.
  const q = [residential ? field('region') : [field('street'), field('number')].filter(Boolean).join(' '), field('region'), field('city'), field('state'), 'Brasil'].filter(Boolean).join(', ');
  return cached('nominatim', 'search:' + residential + ':' + q, 86400000, async () => {
    const url = new URL('search', (process.env.NOMINATIM_BASE_URL || 'https://nominatim.openstreetmap.org/').replace(/\/?$/, '/'));
    url.search = new URLSearchParams({q,format:'jsonv2',addressdetails:'1',limit:'5',countrycodes:'br'}).toString();
    const result = await externalJson(url);
    if (!Array.isArray(result)) throw new ProviderError('Resposta inesperada do serviço de endereços.');
    return result.map(item => parsePlace(item, residential));
  });
}
export async function reverseAddress(body: Coordinates & { residential?: boolean }): Promise<GeocodingResult> {
  if (!isCoordinate(body)) throw new ProviderError('Latitude ou longitude inválida.', 400);
  const p = body.residential ? approximateCoordinates(body) : body;
  return cached('nominatim', `reverse:${p.lat.toFixed(5)},${p.lng.toFixed(5)}:${!!body.residential}`, 86400000, async () => {
    const url = new URL('reverse', (process.env.NOMINATIM_BASE_URL || 'https://nominatim.openstreetmap.org/').replace(/\/?$/, '/'));
    url.search = new URLSearchParams({lat:String(p.lat),lon:String(p.lng),format:'jsonv2',addressdetails:'1',zoom:body.residential?'14':'18'}).toString();
    const result = await externalJson(url) as NominatimItem & {error?:string};
    if (result.error) throw new ProviderError('Endereço não encontrado. Preencha os campos manualmente.', 404);
    return parsePlace(result, !!body.residential);
  });
}
export async function roadRoute(coordinates: Coordinates[]): Promise<RoadRoute> {
  if (!Array.isArray(coordinates) || coordinates.length < 2 || coordinates.length > 22 || !coordinates.every(isCoordinate)) throw new ProviderError('Informe entre 2 e 22 coordenadas válidas.', 400);
  const path = coordinates.map(p => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(';');
  return cached('osrm', path, 3600000, async () => {
    const base = (process.env.OSRM_BASE_URL || 'https://router.project-osrm.org').replace(/\/$/, '');
    const url = new URL(`${base}/route/v1/driving/${path}`);
    url.search = new URLSearchParams({overview:'full',geometries:'geojson',steps:'false',radiuses:coordinates.map(()=>'1000').join(';')}).toString();
    const result = await externalJson(url) as { code: string; routes?: { distance: number; duration: number; geometry: { coordinates: [number,number][] } }[] };
    const route = result.routes?.[0];
    if (result.code !== 'Ok' || !route || !Number.isFinite(route.distance) || !Array.isArray(route.geometry?.coordinates)) throw new ProviderError('Não foi possível encontrar uma rota pelas ruas entre esses pontos. Confira as localizações.', 422);
    return {distanceKm:route.distance/1000,durationMinutes:route.duration/60,geometry:route.geometry.coordinates,provider:'OSRM',calculatedAt:new Date().toISOString()};
  });
}
export async function handleProvider(request: Request, operation: (body: never) => Promise<unknown>) {
  try {
    const {db,env}=await database();checkOrigin(request,env);await limit(db,'maps:'+(request.headers.get('cf-connecting-ip')??'local'),60,60);
    const raw = await request.text();
    if (raw.length > 12000) throw new ProviderError('Consulta muito grande.', 413);
    const body = JSON.parse(raw);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ProviderError('Consulta inválida.', 400);
    return Response.json(await operation(body as never), {headers:{'Cache-Control':'no-store'}});
  } catch (error) {
    const status = error instanceof ProviderError||error instanceof HttpError ? error.status : error instanceof SyntaxError ? 400 : 503;
    return Response.json({error:error instanceof ProviderError||error instanceof HttpError ? error.message : status===400?'Consulta inválida.':'Não foi possível concluir a consulta. Tente novamente.'},{status,headers:{'Cache-Control':'no-store'}});
  }
}

