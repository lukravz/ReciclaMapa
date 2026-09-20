import type {Point,Cooperative} from '../types/index.ts';
import {calculateDistance,visibleLocation,hasDefinedLocation} from './geo.ts';
import {summarizeHistory,type HistoryRecord} from './history.ts';
export type Recurrence=ReturnType<typeof summarizeHistory>&{name:string;material:string;region:string;frequency:string;records:HistoryRecord[];point:Point;lastCollection?:string|null};
export function sourceKey(p:Point){return [p.ownerId??'',p.name.trim().toLowerCase(),p.city?.toLowerCase(),p.state?.toLowerCase(),p.region.trim().toLowerCase(),p.material].join('|');}
export function territoryKey(p:Point){return [p.state??'',p.city??'',p.region].map(s=>s.trim().toLocaleLowerCase('pt-BR')).join('|');}
export function kgPerKm(kg:number,km:number|null){return km!==null&&Number.isFinite(km)&&km>0?kg/km:null;}
export function eligiblePoint(p:Point,c?:Cooperative|null){return p.status==='available'&&hasDefinedLocation(p)&&(!c||(c.acceptedMaterials.includes(p.material)&&p.kg<=c.capacityKg&&calculateDistance(c,visibleLocation(p))<=c.radiusKm));}
export function opportunities(points:Point[],c?:Cooperative|null,history:Recurrence[]=[],now=new Date()){
 const groups=new Map<string,Point[]>();for(const p of points.filter(p=>p.status==='available')){const key=territoryKey(p);groups.set(key,[...(groups.get(key)??[]),p]);}
 // Keep regions with historical generation visible even when current stock is empty.
 for(const h of history)if(!groups.has(territoryKey(h.point)))groups.set(territoryKey(h.point),[]);
 return [...groups].map(([key,items])=>{
  const historical=history.filter(h=>territoryKey(h.point)===key),reference=items[0]??historical[0].point;
  const totalKg=items.reduce((s,p)=>s+p.kg,0),compatible=items.filter(p=>!c||c.acceptedMaterials.includes(p.material)),inside=items.filter(p=>hasDefinedLocation(p)&&(!c||calculateDistance(c,visibleLocation(p))<=c.radiusKm));
  const eligible=items.filter(p=>eligiblePoint(p,c)).sort((a,b)=>c?calculateDistance(c,visibleLocation(a))-calculateDistance(c,visibleLocation(b)):a.id.localeCompare(b.id));
  let reservableKg=0;const selected:Point[]=[];for(const p of eligible){if(selected.length<20&&(!c||reservableKg+p.kg<=c.capacityKg)){selected.push(p);reservableKg+=p.kg;}}
  const located=items.filter(hasDefinedLocation),distances=c?located.map(p=>calculateDistance(c,visibleLocation(p))):[];
  // Mean base-to-point distance, not a route length or a sum of legs.
  const distanceKm=distances.length?distances.reduce((s,d)=>s+d,0)/distances.length:null;
  const materialMap=new Map<string,number>();for(const p of items)materialMap.set(p.material,(materialMap.get(p.material)??0)+p.kg);
  const known=historical.filter(h=>h.weighted!==null&&h.next),forecastKg=known.reduce((s,h)=>s+(new Date(h.next!).getTime()<=now.getTime()+7*864e5&&!points.some(p=>['available','reserved','scheduled'].includes(p.status)&&sourceKey(p)===sourceKey(h.point))?h.weighted!:0),0);
  return {key,region:reference.region,city:reference.city,state:reference.state,totalKg,pointCount:items.length,materials:[...materialMap].map(([name,kg])=>({name,kg})).sort((a,b)=>b.kg-a.kg),recurringSources:new Set([...items.filter(p=>p.frequency!=='Única').map(sourceKey),...historical.map(h=>sourceKey(h.point))]).size,distanceKm,kgPerKm:kgPerKm(reservableKg,distanceKm),compatibleKg:compatible.reduce((s,p)=>s+p.kg,0),compatiblePercent:totalKg?compatible.reduce((s,p)=>s+p.kg,0)/totalKg*100:0,insideKg:inside.reduce((s,p)=>s+p.kg,0),insideCount:inside.length,capacityKg:c?.capacityKg??null,withinCapacity:!c||totalKg<=c.capacityKg,belowMinimum:!!c&&reservableKg<(c.minimumCollectionKg??0),reservableKg,reservableCount:selected.length,ids:selected.map(p=>p.id),pointIds:items.map(p=>p.id),forecastKg:known.length?forecastKg:null};
 });
}
export type Opportunity=ReturnType<typeof opportunities>[number];
export type OpportunityOrder='default'|'quantity'|'distance'|'efficiency'|'points'|'concentration'|'compatibility'|'recurrence';
export function sortOpportunities(items:Opportunity[],order:OpportunityOrder='default'){
 return [...items].sort((a,b)=>{
  if(order==='quantity')return b.totalKg-a.totalKg;if(order==='distance')return (a.distanceKm??Infinity)-(b.distanceKm??Infinity);if(order==='efficiency')return (b.kgPerKm??-1)-(a.kgPerKm??-1);if(order==='points')return b.pointCount-a.pointCount;if(order==='concentration')return b.totalKg/Math.max(1,b.pointCount)-a.totalKg/Math.max(1,a.pointCount);if(order==='compatibility')return b.compatiblePercent-a.compatiblePercent;if(order==='recurrence')return b.recurringSources-a.recurringSources;
  return b.compatiblePercent-a.compatiblePercent||Number(b.insideCount===b.pointCount)-Number(a.insideCount===a.pointCount)||Number(b.withinCapacity)-Number(a.withinCapacity)||(b.kgPerKm??-1)-(a.kgPerKm??-1)||b.totalKg-a.totalKg;
 });
}
