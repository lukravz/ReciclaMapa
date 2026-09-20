import {and,eq,ne,or,inArray,sql,desc,type SQL} from 'drizzle-orm';
import type {Database} from '@/db';
import {wastePoints,cooperatives,cooperativeMaterials,profiles,routePoints,routes,type User,type WasteRow} from '@/db/schema';
import {wasteSchema,wasteQuerySchema,cooperativeSchema,scheduleSchema} from './schemas';
import {HttpError,now,id,audit,atomic,requireUser} from './security';
import {approximateCoordinates,calculateDistance} from '../geo';
import type {Point,Cooperative} from '@/types';
export async function ownCooperative(db:Database,user:User){requireUser(user,['cooperative','collector','admin']);const [coop]=await db.select().from(cooperatives).where(and(eq(cooperatives.ownerUserId,user.id),eq(cooperatives.active,true)));if(!coop)throw new HttpError(409,'Configure sua cooperativa antes de continuar.');return coop;}
export function getPublicCoordinates(point:{lat:number;lng:number;type:string},authorized=false){return point.type==='Residência'&&!authorized?approximateCoordinates(point):{lat:point.lat,lng:point.lng};}
export function serializeWaste(row:WasteRow,user:User|null,cooperativeId?:string):Point{
 const authorized=!!user&&(row.generatorUserId===user.id||row.reservedBy===cooperativeId||user.role==='admin');
 const privateHome=row.type==='Residência'&&!authorized;
 return {id:row.id,name:privateHome?'Gerador residencial':row.name,type:row.type,material:row.material,kg:row.kg,...getPublicCoordinates(row,authorized),address:privateHome?row.addressPublic:row.address,street:privateHome?'':row.street,number:privateHome?'':row.number,postcode:privateHome?'':row.postcode,region:row.region,city:row.city,state:row.state,availability:row.availability,availabilityDate:row.availabilityDate,frequency:row.frequency,source:'registered',createdAt:row.createdAt,status:row.status,coordinateKind:'registered',locationConfirmed:row.locationConfirmed,ownerId:row.generatorUserId,reservedBy:row.reservedBy,scheduledDate:row.scheduledDate,timeWindow:row.timeWindow,scheduleNote:authorized?row.scheduleNote:null,canEdit:row.generatorUserId===user?.id&&row.status==='available'};
}
export async function getWaste(db:Database,pointId:string){const [p]=await db.select().from(wastePoints).where(eq(wastePoints.id,pointId));if(!p)throw new HttpError(404,'Resíduo não encontrado.');return p;}
export async function listWaste(db:Database,user:User|null,params:URLSearchParams){
 const q=wasteQuerySchema.parse(Object.fromEntries(params)),where:SQL[]=[];
 const [coop]=user?await db.select().from(cooperatives).where(eq(cooperatives.ownerUserId,user.id)):[];
 if(q.mine==='true'){requireUser(user);where.push(eq(wastePoints.generatorUserId,user!.id));}
 else if(user?.role!=='admin')where.push(or(eq(wastePoints.status,'available'),...(user?[eq(wastePoints.generatorUserId,user.id)]:[]),...(coop?[eq(wastePoints.reservedBy,coop.id)]:[]))!);
 if(q.type)where.push(eq(wastePoints.type,q.type));if(q.material)where.push(eq(wastePoints.material,q.material));if(q.minimum!==undefined)where.push(sql`${wastePoints.kg}>=${q.minimum}`);if(q.region)where.push(eq(wastePoints.region,q.region));if(q.city)where.push(eq(wastePoints.city,q.city));if(q.recurring==='true')where.push(ne(wastePoints.frequency,'Única'));if(q.status)where.push(eq(wastePoints.status,q.status));if(q.availability)where.push(eq(wastePoints.availability,q.availability));
 if(q.radius&&!coop)throw new HttpError(400,'Configure a cooperativa para filtrar por distância.');
 // Radius is evaluated server-side on privacy-safe coordinates before pagination.
 const all=await db.select().from(wastePoints).where(and(...where)).orderBy(desc(wastePoints.createdAt));
 const filtered=q.radius?all.filter(p=>p.locationConfirmed&&calculateDistance(coop!,getPublicCoordinates(p))<=q.radius!):all;
 const running=await runningPointIds(db);
 return {points:filtered.slice((q.page-1)*q.limit,q.page*q.limit).map(p=>({...serializeWaste(p,user,coop?.id),inProgress:running.has(p.id)})),total:filtered.length,page:q.page,limit:q.limit};
}
export async function createWaste(db:Database,user:User,input:unknown){
 requireUser(user,['generator','admin']);const d=wasteSchema.parse(input),pointId=id(),at=now();
 const values={...d,id:pointId,generatorUserId:user.id,addressPublic:d.type==='Residência'?[d.region,d.city,d.state].join(', '):d.address,availabilityDate:d.availabilityDate??new Date(Date.now()+(d.availability==='Amanhã'?86400000:0)).toISOString().slice(0,10),status:'available' as const,createdAt:at,updatedAt:at};
 await db.batch([db.insert(wastePoints).values(values),audit(db,user.id,'waste.created','waste',pointId)]);return serializeWaste(await getWaste(db,pointId),user);
}
export async function editWaste(db:Database,user:User,pointId:string,input:unknown){
 const d=wasteSchema.parse(input),p=await getWaste(db,pointId);if(p.generatorUserId!==user.id)throw new HttpError(403,'Você só pode editar seus próprios resíduos.');
 await atomic(db,sql`EXISTS(SELECT 1 FROM waste_points WHERE id=${pointId} AND generator_user_id=${user.id} AND status='available')`,[db.update(wastePoints).set({...d,addressPublic:d.type==='Residência'?[d.region,d.city,d.state].join(', '):d.address,updatedAt:now()}).where(eq(wastePoints.id,pointId)),audit(db,user.id,'waste.updated','waste',pointId)]);return serializeWaste(await getWaste(db,pointId),user);
}
export async function reserveWaste(db:Database,user:User,pointId:string){
 const coop=await ownCooperative(db,user),p=await getWaste(db,pointId),accepted=await db.select().from(cooperativeMaterials).where(eq(cooperativeMaterials.cooperativeId,coop.id));
 if(!accepted.some(m=>m.material===p.material))throw new HttpError(409,'Material não aceito por sua cooperativa.');if(p.kg>coop.capacityKg)throw new HttpError(409,'Quantidade acima da capacidade cadastrada.');if(calculateDistance(coop,getPublicCoordinates(p))>coop.radiusKm)throw new HttpError(409,'Ponto fora da área de atuação.');
 await atomic(db,sql`EXISTS(SELECT 1 FROM waste_points WHERE id=${pointId} AND status='available' AND location_confirmed=1)`,[db.update(wastePoints).set({status:'reserved',reservedBy:coop.id,updatedAt:now()}).where(eq(wastePoints.id,pointId)),audit(db,user.id,'waste.reserved','waste',pointId)]);return serializeWaste(await getWaste(db,pointId),user,coop.id);
}
export async function scheduleWaste(db:Database,user:User,pointId:string,input:unknown){
 const coop=await ownCooperative(db,user),d=scheduleSchema.parse(input);if(d.date<now().slice(0,10))throw new HttpError(400,'Escolha uma data a partir de hoje.');
 await atomic(db,sql`EXISTS(SELECT 1 FROM waste_points WHERE id=${pointId} AND reserved_by=${coop.id} AND status IN ('reserved','scheduled')) AND NOT EXISTS(SELECT 1 FROM route_points rp JOIN routes r ON r.id=rp.route_id WHERE rp.waste_point_id=${pointId} AND r.status IN ('draft','scheduled','in_progress'))`,[db.update(wastePoints).set({status:'scheduled',scheduledDate:d.date,timeWindow:d.timeWindow,scheduleNote:d.note,updatedAt:now()}).where(eq(wastePoints.id,pointId)),audit(db,user.id,'collection.scheduled','waste',pointId)]);return serializeWaste(await getWaste(db,pointId),user,coop.id);
}
export async function releaseWaste(db:Database,user:User,pointId:string){
 const coop=await ownCooperative(db,user);
 await atomic(db,sql`EXISTS(SELECT 1 FROM waste_points WHERE id=${pointId} AND reserved_by=${coop.id} AND status IN ('reserved','scheduled')) AND NOT EXISTS(SELECT 1 FROM route_points rp JOIN routes r ON r.id=rp.route_id WHERE rp.waste_point_id=${pointId} AND r.status IN ('draft','scheduled','in_progress'))`,[db.update(wastePoints).set({status:'available',reservedBy:null,scheduledDate:null,timeWindow:null,scheduleNote:null,updatedAt:now()}).where(eq(wastePoints.id,pointId)),audit(db,user.id,'reservation.cancelled','waste',pointId)]);return {ok:true};
}
export async function runningPointIds(db:Database){return new Set((await db.select({id:routePoints.wastePointId}).from(routePoints).innerJoin(routes,eq(routes.id,routePoints.routeId)).where(eq(routes.status,'in_progress'))).map(r=>r.id));}
export async function cancelWaste(db:Database,user:User,pointId:string){
 const p=await getWaste(db,pointId);if(p.generatorUserId!==user.id&&user.role!=='admin')throw new HttpError(403,'Você não pode cancelar este resíduo.');
 const associated=await db.select({id:routes.id}).from(routePoints).innerJoin(routes,eq(routes.id,routePoints.routeId)).where(and(eq(routePoints.wastePointId,pointId),inArray(routes.status,['draft','scheduled','in_progress'])));
 const ids=associated.map(r=>r.id);
 const queries:[...Parameters<Database['batch']>[0]]=[db.update(wastePoints).set({status:'cancelled',reservedBy:null,scheduledDate:null,timeWindow:null,scheduleNote:null,updatedAt:now()}).where(eq(wastePoints.id,pointId)),audit(db,user.id,'waste.cancelled','waste',pointId)];
 if(ids.length){queries.push(db.update(wastePoints).set({status:'available',reservedBy:null,scheduledDate:null,timeWindow:null,scheduleNote:null,updatedAt:now()}).where(and(ne(wastePoints.id,pointId),inArray(wastePoints.status,['reserved','scheduled']),inArray(wastePoints.id,db.select({id:routePoints.wastePointId}).from(routePoints).where(inArray(routePoints.routeId,ids))))),db.update(routes).set({status:'cancelled'}).where(inArray(routes.id,ids)),...ids.map(r=>audit(db,user.id,'route.cancelled','route',r)));}
 await atomic(db,sql`EXISTS(SELECT 1 FROM waste_points WHERE id=${pointId} AND status IN ('available','reserved','scheduled'))`,queries);return {ok:true};
}
export async function saveCooperative(db:Database,user:User,input:unknown){
 requireUser(user,['cooperative','collector','admin']);const d=cooperativeSchema.parse(input),[existing]=await db.select().from(cooperatives).where(eq(cooperatives.ownerUserId,user.id)),coopId=existing?.id??id(),at=now();const {acceptedMaterials,...data}=d;
 await db.batch([db.insert(cooperatives).values({...data,id:coopId,ownerUserId:user.id,createdAt:at,updatedAt:at}).onConflictDoUpdate({target:cooperatives.ownerUserId,set:{...data,updatedAt:at}}),db.delete(cooperativeMaterials).where(eq(cooperativeMaterials.cooperativeId,coopId)),...acceptedMaterials.map(material=>db.insert(cooperativeMaterials).values({cooperativeId:coopId,material})),audit(db,user.id,'cooperative.updated','cooperative',coopId)] as Parameters<Database['batch']>[0]);return getCooperative(db,user);
}
export async function getCooperative(db:Database,user:User):Promise<(Cooperative&{city:string;state:string;description:string})|null>{
 const [c]=await db.select().from(cooperatives).where(eq(cooperatives.ownerUserId,user.id));if(!c)return null;const accepted=await db.select().from(cooperativeMaterials).where(eq(cooperativeMaterials.cooperativeId,c.id));return {...c,source:'registered',acceptedMaterials:accepted.map(x=>x.material)};
}
export async function getProfile(db:Database,user:User){const [p]=await db.select().from(profiles).where(eq(profiles.userId,user.id));return p;}
