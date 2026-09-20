'use client';
import dynamic from 'next/dynamic';
import { LoaderCircle } from 'lucide-react';
import type { Coordinates, Point } from '@/types';
export interface TerritoryMapProps {
  highlighted?:string[]; points: Point[]; selected?: string[]; onToggle?: (id: string) => void;
  route?: boolean; geometry?: [number,number][]; originalGeometry?: [number,number][];
  start?: Coordinates; end?: Coordinates; concentration?: boolean;
  radiusKm?: number; focus?: Coordinates | null;
  picked?: Coordinates | null; onPick?: (p: Coordinates) => void;
  privatePicker?: boolean;
}
const LeafletMap = dynamic(() => import('./Map/leaflet-map'), { ssr:false, loading:() => <div className="map-loading" role="status"><LoaderCircle className="spinning" size={22}/> Carregando mapa...</div> });
export default function TerritoryMap(props: TerritoryMapProps) { return <LeafletMap {...props}/>; }
