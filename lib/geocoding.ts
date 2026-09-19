import type { Coordinates, GeocodingResult } from '@/types';
export interface AddressQuery { street: string; number: string; region: string; city: string; state: string; postcode: string; residential: boolean }
async function request<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? 'Não foi possível buscar o endereço. Preencha manualmente.');
  return result;
}
export function geocodeAddress(query: AddressQuery, signal?: AbortSignal) { return request<GeocodingResult[]>('/api/geocode', query, signal); }
export function reverseGeocode(position: Coordinates, residential = false, signal?: AbortSignal) { return request<GeocodingResult>('/api/reverse-geocode', { ...position, residential }, signal); }
