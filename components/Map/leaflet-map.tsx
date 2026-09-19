'use client';
import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, CircleMarker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.markercluster';
import { LocateFixed, LoaderCircle } from 'lucide-react';
import type { TerritoryMapProps } from '../territory-map';
import { num } from '@/lib/model';
import { hasDefinedLocation, visibleLocation } from '@/lib/geo';
import { locateUser } from '@/lib/geolocation';
import type { Coordinates, Point } from '@/types';
import { DataBadge } from '../primitives';
import {statusLabel} from '@/lib/api-client';
export function materialColor(material: string) {
  if (material.includes('Papel')) return '#c28e17';
  if (material.includes('Plástico')) return '#2d7dbd';
  if (material === 'Vidro') return '#8455a6';
  if (material === 'Eletrônico') return '#d47b28';
  return '#2f8f5b';
}
function pin(color:string,label:string,recurring=false) { return L.divIcon({className:'geo-marker',html:`<span class="geo-pin ${recurring?'recurring-pin':''}" style="background:${color}"><b>${label}</b></span>`,iconSize:[34,40],iconAnchor:[17,38],popupAnchor:[0,-35]}); }
function Bounds({coordinates,focus}:{coordinates:Coordinates[];focus?:Coordinates|null}) {
  const map=useMap(); const key=JSON.stringify(coordinates);
  useEffect(()=>{if(!coordinates.length)return;map.fitBounds(L.latLngBounds(coordinates.map(p=>[p.lat,p.lng])),{padding:[40,40],maxZoom:15,animate:false});},[map,key]);
  useEffect(()=>{if(focus)map.setView([focus.lat,focus.lng],16);},[map,focus?.lat,focus?.lng]);
  useEffect(()=>{const resize=new ResizeObserver(()=>map.invalidateSize());resize.observe(map.getContainer());return()=>resize.disconnect();},[map]);
  return null;
}
function PickLocation({onPick}:{onPick?:(p:Coordinates)=>void}) { useMapEvents({click:e=>onPick?.({lat:e.latlng.lat,lng:e.latlng.lng})}); return null; }
function popupContent(p:Point,onToggle?:(id:string)=>void) {
  const root=document.createElement('div');root.className='cluster-popup';
  for(const text of [p.source==='simulated'?'Dado demonstrativo':'Dado cadastrado',p.name,`${p.material} · ${num(p.kg)} kg`,p.region,`${p.availability} · ${p.frequency}`,statusLabel[p.status],p.type==='Residência'?'Localização residencial aproximada':p.address]) {const el=document.createElement('p');el.textContent=text;root.append(el);}
  if(p.frequency!=='Única'){const note=document.createElement('p');note.textContent='Fonte recorrente';root.append(note);}
  if(onToggle&&p.status==='available'){const button=document.createElement('button');button.className='btn primary';button.textContent='Adicionar à rota';button.onclick=()=>onToggle(p.id);root.append(button);}
  return root;
}
function Clusters({points,onToggle}:{points:Point[];onToggle?:(id:string)=>void}) {
  const map=useMap();
  useEffect(()=>{const group=L.markerClusterGroup({chunkedLoading:true,maxClusterRadius:45,showCoverageOnHover:false,disableClusteringAtZoom:17});
    for(const p of points){const pos=visibleLocation(p);const marker=L.marker([pos.lat,pos.lng],{icon:pin(materialColor(p.material),p.frequency==='Única'?'•':'↻',p.frequency!=='Única'),title:`${p.name}, ${num(p.kg)} kg`});marker.bindPopup(popupContent(p,onToggle));group.addLayer(marker);}
    map.addLayer(group);return()=>{map.removeLayer(group);group.clearLayers();};
  },[map,points,onToggle]);return null;
}
export default function LeafletMap({points,selected=[],onToggle,route=false,geometry,originalGeometry,start,end,concentration=false,radiusKm,focus,picked,onPick,privatePicker=false}:TerritoryMapProps) {
  const [location,setLocation]=useState<Coordinates|null>(null),[locating,setLocating]=useState(false),[error,setError]=useState(''),[tileError,setTileError]=useState(false);
  const visible=useMemo(()=>points.filter(hasDefinedLocation),[points]);
  const markerPoints=visible.filter(p=>selected.includes(p.id)),others=visible.filter(p=>!selected.includes(p.id));
  const routeBounds=useMemo(()=>{
    const line=[...(geometry??[]),...(originalGeometry??[])];
    if(!line.length)return [];
    const extent=line.reduce((b,[lng,lat])=>({south:Math.min(b.south,lat),north:Math.max(b.north,lat),west:Math.min(b.west,lng),east:Math.max(b.east,lng)}),{south:90,north:-90,west:180,east:-180});
    return [{lat:extent.south,lng:extent.west},{lat:extent.north,lng:extent.east}];
  },[geometry,originalGeometry]);
  const bounds:Coordinates[]=[...visible.map(visibleLocation),...routeBounds,...(start?[start]:[]),...(end?[end]:[]),...(picked?[picked]:[])];
  const safeFocus=focus??location??picked;
  async function locate(){setLocating(true);setError('');try{const p=await locateUser();setLocation(p);onPick?.(p);}catch(e){setError((e as Error).message);}finally{setLocating(false);}}
  function marker(p:Point){const pos=visibleLocation(p);const index=selected.indexOf(p.id);return <Marker key={p.id} position={[pos.lat,pos.lng]} icon={pin(materialColor(p.material),index>=0?String(index+1):p.frequency==='Única'?'•':'↻',p.frequency!=='Única')} title={`${p.name}, ${num(p.kg)} kg, ${p.region}`}>
    <Popup minWidth={210} maxWidth={280}><div className="geo-popup"><DataBadge mode={p.source}/><h3>{p.name}</h3><p><b>{p.material} · {num(p.kg)} kg</b></p><dl><div><dt>Região</dt><dd>{p.region}</dd></div><div><dt>Disponibilidade</dt><dd>{p.availability}</dd></div><div><dt>Recorrência</dt><dd>{p.frequency}</dd></div><div><dt>Status</dt><dd>{statusLabel[p.status]}</dd></div></dl>{p.frequency!=='Única'&&<span className="recurring-label">↻ Fonte recorrente</span>}<p>{p.type==='Residência'?'Localização residencial aproximada. Endereço completo protegido.':p.address}</p>{p.source==='registered'&&p.type!=='Residência'&&<DataBadge mode="location"/>}{onToggle&&p.status==='available'&&<button className="btn primary full" onClick={()=>onToggle(p.id)}>{index>=0?'Remover da rota':'Adicionar à rota'}</button>}</div></Popup>
  </Marker>;}
  return <div className={`real-map ${route?'road-map':''}`}>
    <MapContainer center={[-3.7327,-38.5267]} zoom={13} scrollWheelZoom={false} className="leaflet-surface" aria-label="Mapa geográfico de resíduos" zoomControl={true}>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" eventHandlers={{tileerror:()=>setTileError(true)}}/>
      <Bounds coordinates={bounds} focus={safeFocus}/><PickLocation onPick={onPick}/>
      {start&&radiusKm&&<Circle center={[start.lat,start.lng]} radius={radiusKm*1000} pathOptions={{color:'#2f8f5b',weight:1,fillOpacity:.035,dashArray:'6 6'}}/>}
      {start&&<Marker position={[start.lat,start.lng]} icon={pin('#173b2c','A')} title="Ponto inicial"><Popup>Ponto inicial da rota</Popup></Marker>}
      {end&&(!start||end.lat!==start.lat||end.lng!==start.lng)&&<Marker position={[end.lat,end.lng]} icon={pin('#173b2c','F')} title="Destino final"><Popup>Destino final</Popup></Marker>}
      {originalGeometry&&<Polyline positions={originalGeometry.map(([lng,lat])=>[lat,lng])} pathOptions={{color:'#88978c',weight:4,opacity:.65,dashArray:'6 7'}}/>}
      {geometry&&<Polyline positions={geometry.map(([lng,lat])=>[lat,lng])} pathOptions={{color:'#2f8f5b',weight:5,opacity:.95}}/>}
      {concentration&&visible.map(p=>{const pos=visibleLocation(p);return <CircleMarker key={`heat-${p.id}`} center={[pos.lat,pos.lng]} radius={Math.sqrt(p.kg)*3} pathOptions={{color:materialColor(p.material),weight:1,fillOpacity:.22}}><Popup>{p.region} · {num(p.kg)} kg · {p.source==='simulated'?'Dado demonstrativo':'Dado cadastrado'}</Popup></CircleMarker>;})}
      {others.length>20?<Clusters points={others} onToggle={onToggle}/>:others.map(marker)}{markerPoints.map(marker)}
      {picked&&<Marker position={[picked.lat,picked.lng]} icon={pin('#2d7dbd','✓')} title="Localização selecionada"><Popup>{privatePicker?'Posição exata visível apenas neste formulário privado.':'Confirme esta localização no formulário.'}</Popup></Marker>}
      {location&&!onPick&&<CircleMarker center={[location.lat,location.lng]} radius={7} pathOptions={{color:'#fff',weight:3,fillColor:'#2d7dbd',fillOpacity:1}}><Popup>Sua localização nesta sessão</Popup></CircleMarker>}
    </MapContainer>
    <button className="map-locate btn" type="button" disabled={locating} onClick={locate}>{locating?<LoaderCircle className="spinning" size={16}/>:<LocateFixed size={16}/>} {locating?'Obtendo localização...':'Usar minha localização'}</button>
    {(error||tileError)&&<div className="map-network-notice" role="status">{error||'Não foi possível carregar parte do mapa. Verifique sua conexão. Seus cadastros continuam disponíveis.'}<button type="button" onClick={()=>{setError('');setTileError(false);}} aria-label="Fechar aviso do mapa">×</button></div>}
    {points.some(p=>!hasDefinedLocation(p))&&<div className="map-pending">{points.filter(p=>!hasDefinedLocation(p)).length} ponto(s) aguardando confirmação de localização.</div>}
  </div>;
}
