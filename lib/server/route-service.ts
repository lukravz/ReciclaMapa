import {planAccess,routeCreationAllowed} from './plan-service';
import {and,eq,inArray,sql,desc} from 'drizzle-orm';
import type {Database} from '@/db';
import {routes,routePoints,wastePoints,collections,stopResults,cooperativeMaterials,type User} from '@/db/schema';
import {routeSchema,scheduleSchema,collectSchema,stopResultSchema,finishRouteSchema} from './schemas';
import {id,now,HttpError,atomic,audit} from './security';
import {ownCooperative,getPublicCoordinates,serializeWaste,getWaste} from './waste-service';
import {dailyLoad} from './daily-load';
import {roadRoute} from './providers';
import {sortPointsByNearestNeighbor} from '../geo';
import {routeFingerprint} from '../routing';
import {compatibleWindow,needsConfirmation,outcomeStock} from '../collection-reliability';
import type {RouteComparison} from '@/types';
export async function listRoutes(db:Database,user:User){
 const coop=await ownCooperative(db,user);const result=await db.select().from(routes).where(eq(routes.cooperativeId,coop.id)).orderBy(desc(routes.createdAt));
 return Promise.all(result.map(async r=>({...r,comparison:r.comparison?JSON.parse(r.comparison) as RouteComparison:null,results:await db.select().from(stopResults).where(eq(stopResults.routeId,r.id)),points:(await db.select({id:routePoints.wastePointId,position:routePoints.position,point:wastePoints}).from(routePoints).innerJoin(wastePoints,eq(wastePoints.id,routePoints.wastePointId)).where(eq(routePoints.routeId,r.id)).orderBy(routePoints.position)).map(p=>({...p,point:serializeWaste(p.point,user,coop.id)}))})));
}
export async function getOwnedRoute(db:Database,user:User,routeId:string){const coop=await ownCooperative(db,user);const [route]=await db.select().from(routes).where(eq(routes.id,routeId));if(!route)throw new HttpError(404,'Rota não encontrada.');if(route.cooperativeId!==coop.id)throw new HttpError(403,'Esta rota pertence a outra cooperativa.');return {route,coop};}
export async function createRoute(db:Database,user:User,input:unknown){
 const d=routeSchema.parse(input),coop=await ownCooperative(db,user),rows=await db.select().from(wastePoints).where(inArray(wastePoints.id,d.ids));
 if(rows.length!==d.ids.length||rows.some(p=>p.reservedBy!==coop.id||!['reserved','scheduled'].includes(p.status)||!p.locationConfirmed))throw new HttpError(409,'Reserve todos os pontos na sua cooperativa antes de criar a rota.');
 if(rows.some(p=>needsConfirmation(p)))throw new HttpError(409,'Há material com disponibilidade a confirmar. Aguarde o gerador.');
 const access=await planAccess(db,user);if(!access.features.parallelRoutes){const existing=await db.select({id:routes.id}).from(routes).where(and(eq(routes.cooperativeId,coop.id),inArray(routes.status,['draft','scheduled','in_progress']))).limit(1);if(existing.length)throw new HttpError(403,'O Gratuito permite uma rota por vez. Conclua ou cancele a rota aberta. Múltiplas rotas: disponível no Pro.');}
 const total=rows.reduce((s,p)=>s+p.kg,0),accepted=await db.select().from(cooperativeMaterials).where(eq(cooperativeMaterials.cooperativeId,coop.id));
 if(total>coop.capacityKg||rows.some(p=>!accepted.some(m=>m.material===p.material)))throw new HttpError(409,'A rota excede a capacidade ou contém materiais não aceitos.');
 const originalPoints=d.ids.map(pointId=>({...serializeWaste(rows.find(p=>p.id===pointId)!,user,coop.id),...getPublicCoordinates(rows.find(p=>p.id===pointId)!)}));
 let ordered=originalPoints,comparison:RouteComparison|undefined;
 if(d.calculate){const candidate=sortPointsByNearestNeighbor(originalPoints,d.start,d.end),path=(points:typeof originalPoints)=>[d.start,...points.map(p=>({lat:p.lat,lng:p.lng})),...(d.end?[d.end]:[])];const original=await roadRoute(path(originalPoints));const next=candidate.every((p,i)=>p.id===originalPoints[i].id)?original:await roadRoute(path(candidate));if(next.distanceKm<=original.distanceKm)ordered=candidate;comparison={original,suggested:next.distanceKm<=original.distanceKm?next:original,originalIds:d.ids,suggestedIds:ordered.map(p=>p.id),start:d.start,end:d.end,approximateResidential:rows.some(p=>p.type==='Residência'),fingerprint:routeFingerprint(originalPoints,d.start,d.end)};}
 const routeId=id(),at=now();
 await atomic(db,sql`${routeCreationAllowed(coop.id)} AND (SELECT COUNT(*) FROM waste_points WHERE id IN (${sql.join(d.ids.map(v=>sql`${v}`),sql`,`)}) AND reserved_by=${coop.id} AND status IN ('reserved','scheduled'))=${d.ids.length} AND ${sql.join(rows.map(p=>sql`EXISTS(SELECT 1 FROM waste_points WHERE id=${p.id} AND revision=${p.revision} AND (expires_at IS NULL OR (confirmed_at IS NOT NULL AND expires_at>strftime('%Y-%m-%dT%H:%M:%fZ','now'))))`),sql` AND `)} AND NOT EXISTS(SELECT 1 FROM route_points rp JOIN routes r ON r.id=rp.route_id WHERE rp.waste_point_id IN (${sql.join(d.ids.map(v=>sql`${v}`),sql`,`)}) AND r.status IN ('draft','scheduled','in_progress'))`,[
 db.insert(routes).values({id:routeId,cooperativeId:coop.id,status:'draft',reviewRequired:rows.some(p=>p.planningReview),originalDistanceKm:comparison?.original.distanceKm,optimizedDistanceKm:comparison?.suggested.distanceKm,totalWeightKg:total,comparison:comparison?JSON.stringify(comparison):null,createdAt:at}),
 ...ordered.map((p,i)=>db.insert(routePoints).values({id:id(),routeId,wastePointId:p.id,position:i+1,lat:p.lat,lng:p.lng})),audit(db,user.id,'route.created','route',routeId)] as Parameters<Database['batch']>[0]);return {id:routeId,comparison};
}

async function routeRows(db:Database,routeId:string){return db.select({point:wastePoints}).from(routePoints).innerJoin(wastePoints,eq(wastePoints.id,routePoints.wastePointId)).where(eq(routePoints.routeId,routeId)).then(rows=>rows.map(r=>r.point));}
function revisionGuard(points:Awaited<ReturnType<typeof routeRows>>){return sql.join(points.map(p=>sql`EXISTS(SELECT 1 FROM waste_points WHERE id=${p.id} AND revision=${p.revision})`),sql` AND `);}
function checkWindows(points:Awaited<ReturnType<typeof routeRows>>,date:string,window:string){
 const conflicts=points.filter(p=>!compatibleWindow(JSON.parse(p.pickupWindows),date,window));if(conflicts.length)throw new HttpError(409,'Janela incompatível nas paradas: '+conflicts.map(p=>p.type==='Residência'?'Residência · '+p.region:p.name).join(', ')+'. Ajuste o agendamento ou retire essas paradas.');
}
export async function scheduleRoute(db:Database,user:User,routeId:string,input:unknown){
 const {route,coop}=await getOwnedRoute(db,user,routeId),d=scheduleSchema.parse(input),points=await routeRows(db,routeId);
 if(d.date<now().slice(0,10))throw new HttpError(400,'Escolha uma data a partir de hoje.');
 if(!points.length)throw new HttpError(409,'A rota precisa de pelo menos uma parada.');
 if((route.reviewRequired||points.some(p=>p.planningReview))&&!d.review)throw new HttpError(409,'Os materiais mudaram. Revise as paradas e confirme a revisão.');
 checkWindows(points,d.date,d.timeWindow);
 const total=points.reduce((s,p)=>s+p.kg,0),accepted=await db.select().from(cooperativeMaterials).where(eq(cooperativeMaterials.cooperativeId,coop.id));
 if(total>coop.capacityKg||points.some(p=>!accepted.some(a=>a.material===p.material)))throw new HttpError(409,'Revise a capacidade ou os materiais aceitos.');
 await atomic(db,sql`EXISTS(SELECT 1 FROM routes WHERE id=${routeId} AND revision=${route.revision} AND status IN ('draft','scheduled')) AND NOT EXISTS(SELECT 1 FROM stop_results WHERE route_id=${routeId}) AND ${revisionGuard(points)} AND NOT EXISTS(SELECT 1 FROM route_points rp JOIN waste_points w ON w.id=rp.waste_point_id WHERE rp.route_id=${routeId} AND (w.reserved_by IS NOT ${coop.id} OR w.status NOT IN ('reserved','scheduled'))) AND ${dailyLoad(coop.id,d.date,points.map(p=>p.id))}+${total}<=(SELECT daily_capacity_kg FROM cooperatives WHERE id=${coop.id})`,[
 db.update(routes).set({status:'scheduled',scheduledDate:d.date,timeWindow:d.timeWindow,note:d.note,totalWeightKg:total,reviewRequired:false,revision:route.revision+1}).where(eq(routes.id,routeId)),
 db.update(wastePoints).set({status:'scheduled',scheduledDate:d.date,timeWindow:d.timeWindow,scheduleNote:d.note,planningReview:false,revision:sql`${wastePoints.revision}+1`,updatedAt:now()}).where(inArray(wastePoints.id,points.map(p=>p.id))),audit(db,user.id,'collection.scheduled','route',routeId)]);return {ok:true};
}
export async function removeRouteStop(db:Database,user:User,routeId:string,pointId:string){
 const {route,coop}=await getOwnedRoute(db,user,routeId),points=await routeRows(db,routeId),p=points.find(p=>p.id===pointId);if(!p)throw new HttpError(404,'Parada não encontrada.');
 if(points.length<=1)throw new HttpError(409,'Cancele a rota para retirar sua última parada.');
 await atomic(db,sql`EXISTS(SELECT 1 FROM routes WHERE id=${routeId} AND revision=${route.revision} AND status IN ('draft','scheduled')) AND ${revisionGuard(points)} AND NOT EXISTS(SELECT 1 FROM stop_results WHERE route_id=${routeId} AND waste_point_id=${pointId})`,[
 db.delete(routePoints).where(and(eq(routePoints.routeId,routeId),eq(routePoints.wastePointId,pointId))),
 db.update(routes).set({status:'draft',scheduledDate:null,timeWindow:null,comparison:null,originalDistanceKm:null,optimizedDistanceKm:null,totalWeightKg:points.filter(q=>q.id!==pointId).reduce((s,q)=>s+q.kg,0),reviewRequired:true,revision:route.revision+1}).where(eq(routes.id,routeId)),
 db.update(wastePoints).set({status:p.status==='cancelled'?'cancelled':'available',reservedBy:null,scheduledDate:null,timeWindow:null,scheduleNote:null,planningReview:false,revision:p.revision+1,updatedAt:now()}).where(and(eq(wastePoints.id,pointId),eq(wastePoints.reservedBy,coop.id))),
 audit(db,user.id,'route.stop_removed_and_released','route',routeId)]);return {ok:true};
}
export async function reviewRoute(db:Database,user:User,routeId:string){
 const {route}=await getOwnedRoute(db,user,routeId),points=await routeRows(db,routeId);
 if(route.status!=='in_progress')throw new HttpError(409,'Reagende a rota para revisar antes de iniciar.');
 // Execution has already begun. Acknowledgement must not prevent recording failed stops;
 // the updated availability is shown to the operator, while pre-start scheduling remains strict.
 await atomic(db,sql`EXISTS(SELECT 1 FROM routes WHERE id=${routeId} AND revision=${route.revision} AND status='in_progress') AND ${revisionGuard(points)}`,[
 db.update(routes).set({reviewRequired:false,totalWeightKg:points.reduce((s,p)=>s+p.kg,0),revision:route.revision+1}).where(eq(routes.id,routeId)),
 db.update(wastePoints).set({planningReview:false}).where(inArray(wastePoints.id,points.map(p=>p.id))),audit(db,user.id,'route.reviewed','route',routeId)]);return {ok:true};
}
export async function changeRouteStatus(db:Database,user:User,routeId:string,action:'start'|'cancel'){
 const {route,coop}=await getOwnedRoute(db,user,routeId),points=await routeRows(db,routeId);
 if(action==='start'){
  if(route.reviewRequired||points.some(p=>p.planningReview||p.status==='cancelled'))throw new HttpError(409,'Há alterações pendentes. Revise e reagende a rota.');
  if(route.scheduledDate&&route.timeWindow)checkWindows(points,route.scheduledDate,route.timeWindow);
 }else if((await db.select().from(stopResults).where(eq(stopResults.routeId,routeId))).length)throw new HttpError(409,'A rota já tem resultados. Registre as demais ocorrências e finalize-a.');
 const condition=action==='start'?sql`status='scheduled' AND review_required=0`:sql`status IN ('draft','scheduled','in_progress')`;
 const queries:[...Parameters<Database['batch']>[0]]=[db.update(routes).set({status:action==='start'?'in_progress':'cancelled',revision:route.revision+1}).where(eq(routes.id,routeId)),audit(db,user.id,action==='start'?'route.started':'route.cancelled','route',routeId)];
 if(action==='cancel')queries.push(db.update(wastePoints).set({status:'available',reservedBy:null,scheduledDate:null,timeWindow:null,scheduleNote:null,planningReview:false,revision:sql`${wastePoints.revision}+1`,updatedAt:now()}).where(and(eq(wastePoints.reservedBy,coop.id),inArray(wastePoints.status,['reserved','scheduled']),inArray(wastePoints.id,points.map(p=>p.id)))),db.update(wastePoints).set({reservedBy:null,planningReview:false}).where(and(eq(wastePoints.status,'cancelled'),inArray(wastePoints.id,points.map(p=>p.id)))));
 await atomic(db,sql`EXISTS(SELECT 1 FROM routes WHERE id=${routeId} AND revision=${route.revision} AND ${condition}) AND ${revisionGuard(points)} AND ${action==='cancel'?sql`NOT EXISTS(SELECT 1 FROM stop_results WHERE route_id=${routeId})`:sql`1=1`}`,queries);return {ok:true};
}
export async function recordStopResult(db:Database,user:User,pointId:string,input:unknown,routeId?:string){
 const coop=await ownCooperative(db,user),p=await getWaste(db,pointId),d=stopResultSchema.parse(input),at=now();
 if(routeId&&d.distanceKm!==undefined)throw new HttpError(400,'Informe o percurso da rota ao finalizar, não por parada.');
 let stock;try{stock=outcomeStock(d.outcome,d.actualWeight,d.remainingAvailable??false,d.remainingKg);}catch(e){throw new HttpError(400,(e as Error).message);}
 if(d.date>at.slice(0,10)||p.scheduledDate&&d.date<p.scheduledDate)throw new HttpError(400,'Data de resultado inválida. Reagende se necessário.');
 const owned=routeId?await getOwnedRoute(db,user,routeId):null;
 if(p.reservedBy!==coop.id)throw new HttpError(403,'Esta parada não está sob sua responsabilidade.');
 if(p.planningReview&&(!!routeId||!d.review)||owned?.route.reviewRequired)throw new HttpError(409,'Revise as alterações do gerador antes de registrar o resultado.');
 if(p.status==='cancelled'&&stock.actualWeight>0)throw new HttpError(409,'O gerador retirou este anúncio. Registre a ocorrência sem retirada.');
 if(!routeId){const [active]=await db.select({id:routes.id}).from(routePoints).innerJoin(routes,eq(routes.id,routePoints.routeId)).where(and(eq(routePoints.wastePointId,pointId),inArray(routes.status,['draft','scheduled','in_progress']))).limit(1);if(active)throw new HttpError(409,'Esta parada pertence a uma rota. Registre seu resultado na página Rotas.');}
 const resultId=id(),collectionId=routeId?null:id(),positive=stock.actualWeight>0;
 const condition=sql`EXISTS(SELECT 1 FROM waste_points WHERE id=${pointId} AND reserved_by=${coop.id} AND revision=${d.revision} AND (planning_review=0 OR ${!routeId&&d.review?1:0}=1) AND status IN ('scheduled','cancelled')) AND ${routeId?sql`EXISTS(SELECT 1 FROM routes r JOIN route_points rp ON rp.route_id=r.id WHERE r.id=${routeId} AND r.cooperative_id=${coop.id} AND r.status IN ('scheduled','in_progress') AND r.revision=${owned!.route.revision} AND r.review_required=0 AND rp.waste_point_id=${pointId}) AND NOT EXISTS(SELECT 1 FROM stop_results WHERE route_id=${routeId} AND waste_point_id=${pointId})`:sql`NOT EXISTS(SELECT 1 FROM route_points rp JOIN routes r ON r.id=rp.route_id WHERE rp.waste_point_id=${pointId} AND r.status IN ('draft','scheduled','in_progress'))`}`;
 const queries:[...Parameters<Database['batch']>[0]]=[audit(db,user.id,'collection.stop_recording','waste',pointId)];
 if(collectionId)queries.push(db.insert(collections).values({id:collectionId,cooperativeId:coop.id,date:d.date,status:'completed',totalWeightKg:stock.actualWeight,totalDistanceKm:d.distanceKm??null,createdAt:at}));
 queries.push(db.insert(stopResults).values({id:resultId,routeId:routeId??null,collectionId,wastePointId:pointId,cooperativeId:coop.id,recordedBy:user.id,outcome:d.outcome,pointSnapshot:JSON.stringify(serializeWaste(p,null)),estimatedWeight:p.kg,actualWeight:stock.actualWeight,remainingKg:stock.remainingKg,note:d.note,date:d.date,createdAt:at}));
 if(routeId){
  queries.push(db.update(wastePoints).set({status:positive?'collected':p.status,revision:d.revision+1,updatedAt:at}).where(eq(wastePoints.id,pointId)),db.update(routes).set({status:'in_progress',revision:owned!.route.revision+1}).where(eq(routes.id,routeId)));
 }else{
  const remaining=stock.remainingKg>0;
  queries.push(db.update(wastePoints).set({status:p.status==='cancelled'?'cancelled':positive&&!remaining?'collected':'available',kg:remaining?stock.remainingKg:p.kg,reservedBy:null,scheduledDate:null,timeWindow:null,scheduleNote:null,planningReview:false,revision:d.revision+1,confirmedAt:remaining?at:positive?p.confirmedAt:null,expiresAt:remaining?new Date(Date.parse(at)+p.validityDays*86400000).toISOString():positive?p.expiresAt:at,updatedAt:at}).where(eq(wastePoints.id,pointId)));
 }
 queries.push(audit(db,user.id,'collection.stop_result','waste',pointId),...(collectionId?[audit(db,user.id,'collection.completed','collection',collectionId)]:[]));
 await atomic(db,condition,queries);return {id:resultId,collectionId,...stock};
}
export async function finishRoute(db:Database,user:User,routeId:string,input:unknown){
 const {route,coop}=await getOwnedRoute(db,user,routeId),d=finishRouteSchema.parse(input),points=await routeRows(db,routeId),results=await db.select().from(stopResults).where(eq(stopResults.routeId,routeId));
 if(route.reviewRequired)throw new HttpError(409,'Confirme a revisão do planejamento antes de finalizar.');
 if(!points.length||results.length!==points.length||points.some(p=>!results.some(r=>r.wastePointId===p.id)))throw new HttpError(409,'Registre um resultado para cada parada, inclusive as sem sucesso.');
 const at=now(),collectionId=id(),total=results.reduce((s,r)=>s+r.actualWeight,0),date=results.map(r=>r.date).sort().at(-1)!;
 const queries:[...Parameters<Database['batch']>[0]]=[
 db.insert(collections).values({id:collectionId,cooperativeId:coop.id,routeId,date,status:'completed',totalWeightKg:total,totalDistanceKm:d.distanceKm??null,createdAt:at}),
 db.update(routes).set({status:'completed',completedAt:at,revision:route.revision+1}).where(eq(routes.id,routeId)),
 db.update(stopResults).set({collectionId}).where(eq(stopResults.routeId,routeId))];
 for(const p of points){const result=results.find(r=>r.wastePointId===p.id)!,remaining=result.remainingKg>0,positive=result.actualWeight>0;
  queries.push(db.update(wastePoints).set({status:p.status==='cancelled'?'cancelled':positive&&!remaining?'collected':'available',kg:remaining?result.remainingKg:p.kg,reservedBy:null,scheduledDate:null,timeWindow:null,scheduleNote:null,planningReview:false,revision:p.revision+1,confirmedAt:remaining?at:positive?p.confirmedAt:null,expiresAt:remaining?new Date(Date.parse(at)+p.validityDays*86400000).toISOString():positive?p.expiresAt:at,updatedAt:at}).where(eq(wastePoints.id,p.id)));
 }
 queries.push(audit(db,user.id,'route.completed','route',routeId),audit(db,user.id,'collection.completed','collection',collectionId));
 await atomic(db,sql`EXISTS(SELECT 1 FROM routes WHERE id=${routeId} AND revision=${route.revision} AND review_required=0 AND status IN ('scheduled','in_progress')) AND ${revisionGuard(points)} AND (SELECT COUNT(*) FROM stop_results WHERE route_id=${routeId})=${points.length}`,queries);return {id:collectionId,totalWeightKg:total};
}
// Compatibility endpoint: older clients can still report a full, successful collection.
export async function collect(db:Database,user:User,input:unknown,routeId?:string,pointId?:string){
 const d=collectSchema.parse(input);
 if(pointId&&(d.items.length!==1||d.items[0].id!==pointId))throw new HttpError(400,'Resíduo da coleta inválido.');
 if(routeId){const {route}=await getOwnedRoute(db,user,routeId),points=await routeRows(db,routeId);if(!['scheduled','in_progress'].includes(route.status))throw new HttpError(409,'Rota encerrada.');if(points.length!==d.items.length||points.some(p=>!d.items.some(i=>i.id===p.id)))throw new HttpError(400,'Informe todas as paradas.');}
 for(const item of d.items){const p=await getWaste(db,item.id);await recordStopResult(db,user,item.id,{date:d.date,outcome:'collected',actualWeight:item.actualWeight,revision:p.revision,...(!routeId&&d.distanceKm!==undefined?{distanceKm:d.distanceKm}:{})},routeId);}
 return routeId?finishRoute(db,user,routeId,{distanceKm:d.distanceKm}):{ok:true};
}
