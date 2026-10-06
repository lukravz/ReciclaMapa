export type Mode = 'simulated' | 'registered';
export interface Coordinates { lat: number; lng: number }
export interface AddressFields { street?: string; number?: string; city?: string; state?: string; postcode?: string }
export interface WastePoint extends Coordinates, AddressFields {
  id: string; name: string; type: string; material: string; kg: number;
  address: string; region: string; availability: string; frequency: string;
  source: Mode; createdAt: string; status: 'available' | 'reserved' | 'scheduled' | 'collected' | 'cancelled';
  pickupWindows?:import('@/lib/collection-reliability').PickupWindow[]; accessNote?:string; confirmedAt?:string|null; expiresAt?:string|null; validityDays?:number; revision?:number; needsConfirmation?:boolean; planningReview?:boolean; results?:StopResult[];
  inProgress?:boolean; ownerId?:string; reservedBy?:string|null; scheduledDate?:string|null; timeWindow?:string|null; scheduleNote?:string|null; availabilityDate?:string; canEdit?:boolean;
  coordinateKind: 'registered' | 'schematic' | 'demonstrative';
  locationConfirmed?: boolean;
}
export type Point = WastePoint;
export interface Cooperative extends Coordinates {
  id: string; name: string; address: string; radiusKm: number; city?:string; state?:string; description?:string;
  minimumCollectionKg?: number; acceptedMaterials: string[]; capacityKg: number; source: Mode;
}
export interface RoadRoute {
  distanceKm: number; durationMinutes: number; geometry: [number, number][];
  provider: 'OSRM'; calculatedAt: string;
}
export interface RouteComparison {
  original: RoadRoute; suggested: RoadRoute; originalIds: string[]; suggestedIds: string[];
  start: Coordinates; end?: Coordinates; approximateResidential: boolean;
  fingerprint: string;
}
export interface RoutePlan {
  ids: string[]; originalIds: string[]; date: string; optimized: boolean;
  comparison?: RouteComparison;
}
export interface StopResult {pointSnapshot?:string|null;id:string;wastePointId:string;outcome:import('@/lib/collection-reliability').Outcome;estimatedWeight:number;actualWeight:number;remainingKg:number;note:string;date:string;routeId?:string|null}
export interface Collection {
  id: string; date: string; points: Point[]; kg: number; completed?:boolean; results?:StopResult[]; routeId?:string|null;
  route?: RouteComparison;
  // Planned road distance is not a GPS measurement of actual travel.
  actualDistanceKm?: number;
}
export interface Workspace {
  points: Point[]; collections: Collection[]; plan: RoutePlan | null;
  cooperative?: Cooperative | null;
}
export interface ValidationInterview {
  collectors: number; cooperatives: number; businesses: number; residents: number;
  problem: string; current: string; difficulty: string; wouldUse: string; notes: string;
}
export type Validation = ValidationInterview;
export interface AppState {
  version: 1 | 2; mode?: Mode; simulated: Workspace; registered: Workspace;
  validation: Validation; migrationNotice?: boolean;
}
export interface GeocodingResult extends Coordinates, AddressFields {
  label: string; region: string;
}
