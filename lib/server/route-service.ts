import {and,eq,inArray,sql,desc} from 'drizzle-orm';
import type {Database} from '@/db';
import {routes,routePoints,wastePoints,collections,collectionItems,cooperativeMaterials,type User} from '@/db/schema';
import {routeSchema,scheduleSchema,collectSchema} from './schemas';
import {id,now,HttpError,atomic,audit} from './security';
import {ownCooperative,getPublicCoordinates,serializeWaste,getWaste} from './waste-service';
import {roadRoute} from './providers';
import {sortPointsByNearestNeighbor} from '../geo';
import {routeFingerprint} from '../routing';
import type {RouteComparison} from '@/types';
export async function listRoutes(db:Database,user:User){
 const coop=await ownCooperative(db,user);const result=await db.select().from(routes).where(eq(routes.cooperativeId,coop.id)).orderBy(desc(routes.createdAt));
 return Promise.all(result.map(async r=>({...r,comparison:r.comparison?JSON.parse(r.comparison) as RouteComparison:null,points:await db.select({id:routePoints.wastePointId,position:routePoints.position}).from(routePoints).where(eq(routePoints.routeId,r.id)).orderBy(routePoints.position)})));
}
export async function getOwnedRoute(db:Database,user:User,routeId:string){const coop=await ownCooperative(db,user);const [route]=await db.select().from(routes).where(eq(routes.id,routeId));if(!route)throw new HttpError(404,'Rota não encontrada.');if(route.cooperativeId!==coop.id)throw new HttpError(403,'Esta rota pertence a outra cooperativa.');return {route,coop};}
export async function createRoute(db:Database,user:User,input:unknown){
 const d=routeSchema.parse(input),coop=await ownCooperative(db,user),rows=await db.select().from(wastePoints).where(inArray(wastePoints.id,d.ids));
 if(rows.length!==d.ids.length||rows.some(p=>p.reservedBy!==coop.id||!['reserved','scheduled'].includes(p.status)||!p.locationConfirmed))throw new HttpError(409,'Reserve todos os pontos na sua cooperativa antes de criar a rota.');
 const total=rows.reduce((s,p)=>s+p.kg,0),accepted=await db.select().from(cooperativeMaterials).where(eq(cooperativeMaterials.cooperativeId,coop.id));
 if(total>coop.capacityKg||rows.some(p=>!accepted.some(m=>m.material===p.material)))throw new HttpError(409,'A rota excede a capacidade ou contém materiais não aceitos.');
 const originalPoints=d.ids.map(pointId=>({...serializeWaste(rows.find(p=>p.id===pointId)!,user,coop.id),...getPublicCoordinates(rows.find(p=>p.id===pointId)!)}));
 let ordered=originalPoints,comparison:RouteComparison|undefined;
 if(d.calculate){const candidate=sortPointsByNearestNeighbor(originalPoints,d.start,d.end),path=(points:typeof originalPoints)=>[d.start,...points.map(p=>({lat:p.lat,lng:p.lng})),...(d.end?[d.end]:[])];const original=await roadRoute(path(originalPoints));const next=candidate.every((p,i)=>p.id===originalPoints[i].id)?original:await roadRoute(path(candidate));if(next.distanceKm<=original.distanceKm)ordered=candidate;comparison={original,suggested:next.distanceKm<=original.distanceKm?next:original,originalIds:d.ids,suggestedIds:ordered.map(p=>p.id),start:d.start,end:d.end,approximateResidential:rows.some(p=>p.type==='Residência'),fingerprint:routeFingerprint(originalPoints,d.start,d.end)};}
 const routeId=id(),at=now();
 await atomic(db,sql`(SELECT COUNT(*) FROM waste_points WHERE id IN (${sql.join(d.ids.map(v=>sql`${v}`),sql`,`)}) AND reserved_by=${coop.id} AND status IN ('reserved','scheduled'))=${d.ids.length} AND NOT EXISTS(SELECT 1 FROM route_points rp JOIN routes r ON r.id=rp.route_id WHERE rp.waste_point_id IN (${sql.join(d.ids.map(v=>sql`${v}`),sql`,`)}) AND r.status IN ('draft','scheduled','in_progress'))`,[
 db.insert(routes).values({id:routeId,cooperativeId:coop.id,status:'draft',originalDistanceKm:comparison?.original.distanceKm,optimizedDistanceKm:comparison?.suggested.distanceKm,totalWeightKg:total,comparison:comparison?JSON.stringify(comparison):null,createdAt:at}),
 ...ordered.map((p,i)=>db.insert(routePoints).values({id:id(),routeId,wastePointId:p.id,position:i+1,lat:p.lat,lng:p.lng})),audit(db,user.id,'route.created','route',routeId)] as Parameters<Database['batch']>[0]);return {id:routeId,comparison};
}
export async function scheduleRoute(db:Database,user:User,routeId:string,input:unknown){
 const {route,coop}=await getOwnedRoute(db,user,routeId),d=scheduleSchema.parse(input);if(d.date<now().slice(0,10))throw new HttpError(400,'Escolha uma data a partir de hoje.');
 await atomic(db,sql`EXISTS(SELECT 1 FROM routes WHERE id=${routeId} AND status IN ('draft','scheduled')) AND NOT EXISTS(SELECT 1 FROM route_points rp JOIN waste_points w ON w.id=rp.waste_point_id WHERE rp.route_id=${routeId} AND (w.reserved_by<>${coop.id} OR w.status NOT IN ('reserved','scheduled'))) AND (SELECT COALESCE(SUM(quantity_kg),0) FROM waste_points WHERE reserved_by=${coop.id} AND scheduled_date=${d.date} AND status IN ('scheduled','collected') AND id NOT IN (SELECT waste_point_id FROM route_points WHERE route_id=${routeId}))+${route.totalWeightKg}<=${coop.capacityKg}`,[
 db.update(routes).set({status:'scheduled',scheduledDate:d.date,timeWindow:d.timeWindow,note:d.note}).where(eq(routes.id,routeId)),db.update(wastePoints).set({status:'scheduled',scheduledDate:d.date,timeWindow:d.timeWindow,scheduleNote:d.note,updatedAt:now()}).where(inArray(wastePoints.id,db.select({id:routePoints.wastePointId}).from(routePoints).where(eq(routePoints.routeId,routeId)))),audit(db,user.id,'collection.scheduled','route',routeId)]);return {ok:true};
}
export async function changeRouteStatus(db:Database,user:User,routeId:string,action:'start'|'cancel'){
 const {coop}=await getOwnedRoute(db,user,routeId),condition=action==='start'?sql`status='scheduled'`:sql`status IN ('draft','scheduled','in_progress')`;
 const queries:[...Parameters<Database['batch']>[0]]=[db.update(routes).set({status:action==='start'?'in_progress':'cancelled'}).where(eq(routes.id,routeId)),audit(db,user.id,action==='start'?'route.started':'route.cancelled','route',routeId)];
 if(action==='cancel')queries.push(db.update(wastePoints).set({status:'available',reservedBy:null,scheduledDate:null,timeWindow:null,scheduleNote:null,updatedAt:now()}).where(and(eq(wastePoints.reservedBy,coop.id),inArray(wastePoints.status,['reserved','scheduled']),inArray(wastePoints.id,db.select({id:routePoints.wastePointId}).from(routePoints).where(eq(routePoints.routeId,routeId))))));
 await atomic(db,sql`EXISTS(SELECT 1 FROM routes WHERE id=${routeId} AND ${condition})`,queries);return {ok:true};
}
export async function collect(db:Database,user:User,input:unknown,routeId?:string,pointId?:string){
 const coop=await ownCooperative(db,user),d=collectSchema.parse(input),ids=d.items.map(i=>i.id),at=now();
 if(d.date>at.slice(0,10))throw new HttpError(400,'Uma coleta realizada não pode ter data futura.');
 if(pointId&&(ids.length!==1||ids[0]!==pointId))throw new HttpError(400,'Resíduo da coleta inválido.');
 const points=await db.select().from(wastePoints).where(inArray(wastePoints.id,ids));
 if(points.length!==ids.length||points.some(p=>p.reservedBy!==coop.id||p.status!=='scheduled'))throw new HttpError(409,'A coleta deve estar agendada para sua cooperativa.');
 if(points.some(p=>p.scheduledDate&&p.scheduledDate>d.date))throw new HttpError(400,'A data realizada é anterior ao agendamento. Reagende primeiro.');
 if(routeId){await getOwnedRoute(db,user,routeId);const stops=await db.select().from(routePoints).where(eq(routePoints.routeId,routeId));if(stops.length!==ids.length||stops.some(s=>!ids.includes(s.wastePointId)))throw new HttpError(400,'Informe o peso real de todas as paradas.');}
 const collectionId=id(),total=d.items.reduce((s,i)=>s+i.actualWeight,0),condition=sql`(SELECT COUNT(*) FROM waste_points WHERE id IN (${sql.join(ids.map(v=>sql`${v}`),sql`,`)}) AND reserved_by=${coop.id} AND status='scheduled')=${ids.length} AND ${routeId?sql`EXISTS(SELECT 1 FROM routes WHERE id=${routeId} AND status IN ('scheduled','in_progress'))`:sql`NOT EXISTS(SELECT 1 FROM route_points rp JOIN routes r ON r.id=rp.route_id WHERE rp.waste_point_id IN (${sql.join(ids.map(v=>sql`${v}`),sql`,`)}) AND r.status IN ('draft','scheduled','in_progress'))`}`;
 await atomic(db,condition,[db.insert(collections).values({id:collectionId,cooperativeId:coop.id,routeId:routeId??null,date:d.date,status:'completed',totalWeightKg:total,totalDistanceKm:d.distanceKm??null,createdAt:at}),...d.items.map(item=>db.insert(collectionItems).values({id:id(),collectionId,wastePointId:item.id,estimatedWeight:points.find(p=>p.id===item.id)!.kg,actualWeight:item.actualWeight,collectedAt:d.date})),db.update(wastePoints).set({status:'collected',updatedAt:at}).where(inArray(wastePoints.id,ids)),...(routeId?[db.update(routes).set({status:'completed',completedAt:at}).where(eq(routes.id,routeId)),audit(db,user.id,'route.completed','route',routeId)]:[]),audit(db,user.id,'collection.completed','collection',collectionId)] as Parameters<Database['batch']>[0]);return {id:collectionId,totalWeightKg:total};
}
