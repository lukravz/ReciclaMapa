import {summarizeHistory} from './history.ts';
import { calculateDistance, calculateRouteDistance, sortPointsByNearestNeighbor, hasDefinedLocation } from './geo.ts';
import type { AppState, Point, Workspace, Validation, Cooperative } from '../types/index.ts';
export type { AppState, Point, Workspace, Validation, Cooperative, Mode, RoutePlan, Collection } from '../types/index.ts';
export const MATERIALS = ['Papelão','Papel','Plástico PET','Plástico rígido','Alumínio','Metal','Vidro','Eletrônico','Outro'] as const;
export const TYPES = ['Residência','Comércio','Escola','Restaurante','Mercado','Empresa','Outro'] as const;
export const AVAILABILITIES = ['Hoje','Amanhã','Esta semana','Recorrente'] as const;
export const FREQUENCIES = ['Única','Semanal','Quinzenal','Mensal'] as const;
export const emptyValidation:Validation = {collectors:0,cooperatives:0,businesses:0,residents:0,problem:'',current:'',difficulty:'',wouldUse:'Não informado',notes:''};
export const num = (n:number) => n.toLocaleString('pt-BR',{maximumFractionDigits:1});
export const totalKg = (points:Point[]) => points.reduce((sum,p)=>sum+p.kg,0);
export const activePoints = (w:Workspace) => w.points.filter(p=>p.status==='available');
export function demoCooperative(): Cooperative {return {id:'demo-cooperative',name:'Cooperativa Verde (demo)',address:'Ponto de partida demonstrativo · Fortaleza, CE',lat:-3.7463,lng:-38.5385,radiusKm:15,acceptedMaterials:[...MATERIALS],capacityKg:300,source:'simulated'};}
export function initialState():AppState { return { version:2,mode:'simulated',simulated:{points:seedPoints(),collections:[],plan:null,cooperative:demoCooperative()},registered:{points:[],collections:[],plan:null,cooperative:null},validation:{...emptyValidation} }; }
export function seedPoints():Point[] {
 const data:[string,string,string,number,string,string,number,number][] = [
 ['Mercado Central','Mercado','Papelão',42,'Centro','Semanal',-3.7327,-38.5267],
 ['Escola Municipal','Escola','Plástico PET',18,'Centro','Semanal',-3.7234,-38.5286],
 ['Restaurante Sabor','Restaurante','Alumínio',13,'Centro','Semanal',-3.7313,-38.5361],
 ['Loja Horizonte','Comércio','Papelão',29,'Centro','Quinzenal',-3.7259,-38.5197],
 ['Condomínio Verde','Residência','Vidro',24,'Bairro Norte','Mensal',-3.7245,-38.509],
 ['Mercadinho União','Mercado','Plástico rígido',31,'Bairro Sul','Semanal',-3.749,-38.530]];
 return data.map(([name,type,material,kg,region,frequency,lat,lng],i)=>({id:`sample-${i}`,name,type,material,kg,region,frequency,lat,lng,address:`Ponto fictício ${i+1} · Fortaleza, CE`,city:'Fortaleza',state:'CE',availability:i===5?'Amanhã':'Hoje',source:'simulated',createdAt:new Date().toISOString(),status:'available',coordinateKind:'demonstrative',locationConfirmed:true}));
}
export function demoWorkspace():Workspace {const points=seedPoints(); points[3].kg=25;points.push({...points[0],id:'demo-extra',name:'Papelaria do Centro',kg:26,lat:-3.736,lng:-38.529}); return {points,collections:[],plan:null,cooperative:demoCooperative()};}
export function regions(points:Point[]) {const groups=new Map<string,Point[]>();for(const p of points){const name=p.region.trim();const key=[...groups.keys()].find(k=>k.toLocaleLowerCase('pt-BR')===name.toLocaleLowerCase('pt-BR'))??name;groups.set(key,[...(groups.get(key)??[]),p]);}return [...groups].map(([name,items])=>({name,kg:totalKg(items),points:items})).sort((a,b)=>b.kg-a.kg);}
export function materials(points:Point[]) {return MATERIALS.map(name=>({name,kg:totalKg(points.filter(p=>p.material===name))})).filter(g=>g.kg>0).sort((a,b)=>b.kg-a.kg);}
export const distance = calculateDistance;
export const routeDistance = calculateRouteDistance;
export const optimizeRoute = sortPointsByNearestNeighbor;
export function completeCollection(w:Workspace,ids:string[],date=new Date().toISOString(),actualDistanceKm?:number):Workspace {const selected=activePoints(w).filter(p=>ids.includes(p.id));if(!selected.length)return w;const comparison=w.plan?.comparison;const matching=comparison&&comparison.suggestedIds.length===selected.length&&comparison.suggestedIds.every(id=>selected.some(p=>p.id===id));const collection={id:`collection-${crypto.randomUUID()}`,date,points:selected.map(p=>({...p,status:'collected' as const})),kg:totalKg(selected),...(matching?{route:comparison}:{}),...(typeof actualDistanceKm==='number'&&Number.isFinite(actualDistanceKm)&&actualDistanceKm>=0?{actualDistanceKm}:{})};return {...w,points:w.points.map(p=>selected.some(s=>s.id===p.id)?{...p,status:'collected'}:p),collections:[collection,...w.collections],plan:null};}
export function addPoint(w:Workspace,point:Point):Workspace {if(!point.name.trim()||!point.address.trim()||!point.region.trim()||!Number.isFinite(point.kg)||point.kg<=0||!hasDefinedLocation(point))throw new Error('Confira nome, quantidade e confirme a localização no mapa.');return {...w,points:[...w.points,point]};}
export function historyFor(w:Workspace,p:Point){return w.collections.flatMap(c=>c.points.filter(q=>q.name.trim().toLowerCase()===p.name.trim().toLowerCase()&&q.region.toLowerCase()===p.region.toLowerCase()&&q.material===p.material).map(q=>({date:c.date,kg:q.kg}))).sort((a,b)=>a.date.localeCompare(b.date));}
export function forecast(w:Workspace,p:Point,now=new Date()){const h=summarizeHistory(historyFor(w,p),p.frequency,now);if(h.weighted===null||!h.next)return null;return {average:h.weighted,next:new Date(h.next),period:h.period!,samples:h.samples};}
export function forecast7Days(w:Workspace,now=new Date()){const seen=new Set<string>();let kg=0;for(const p of w.points){const key=[p.name.toLowerCase(),p.region.toLowerCase(),p.material].join('|');if(seen.has(key))continue;seen.add(key);const estimate=forecast(w,p,now);if(estimate&&estimate.next.getTime()-now.getTime()<=7*864e5&&!activePoints(w).some(q=>[q.name.toLowerCase(),q.region.toLowerCase(),q.material].join('|')===key))kg+=estimate.average;}return kg;}
