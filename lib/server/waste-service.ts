import {and,eq,ne,or,inArray,sql,desc,type SQL} from 'drizzle-orm';
import type {Database} from '@/db';
import {wastePoints,cooperatives,cooperativeMaterials,profiles,routePoints,routes,stopResults,type User,type WasteRow} from '@/db/schema';
import {wasteSchema,wasteQuerySchema,cooperativeSchema,scheduleSchema,confirmationSchema} from './schemas';
import {dailyLoad} from './daily-load';
import {HttpError,now,id,audit,atomic,requireUser} from './security';
import {approximateCoordinates,calculateDistance} from '../geo';
import {needsConfirmation,expiry,compatibleWindow,defaultValidity} from '../collection-reliability';
import type {Point,Cooperative} from '@/types';
export async function ownCooperative(db:Database,user:User){requireUser(user,['cooperative','collector','admin']);const [coop]=await db.select().from(cooperatives).where(and(eq(cooperatives.ownerUserId,user.id),eq(cooperatives.active,true)));if(!coop)throw new HttpError(409,'Configure sua cooperativa antes de continuar.');return coop;}
export function getPublicCoordinates(point:{lat:number;lng:number;type:string},authorized=false){return point.type==='Residência'&&!authorized?approximateCoordinates(point):{lat:point.lat,lng:point.lng};}
export function serializeWaste(row:WasteRow,user:User|null,cooperativeId?:string):Point{
 const authorized=!!user&&(row.generatorUserId===user.id||row.reservedBy===cooperativeId||user.role==='admin');
 const privateHome=row.type==='Residência'&&!authorized;
 return {id:row.id,name:privateHome?'Gerador residencial':row.name,type:row.type,material:row.material,kg:row.kg,...getPublicCoordinates(row,authorized),address:privateHome?row.addressPublic:row.address,street:privateHome?'':row.street,number:privateHome?'':row.number,postcode:privateHome?'':row.postcode,region:row.region,city:row.city,state:row.state,availability:row.availability,availabilityDate:row.availabilityDate,frequency:row.frequency,source:'registered',createdAt:row.createdAt,status:row.status,coordinateKind:'registered',locationConfirmed:row.locationConfirmed,ownerId:row.generatorUserId,reservedBy:row.reservedBy,scheduledDate:row.scheduledDate,timeWindow:row.timeWindow,scheduleNote:authorized?row.scheduleNote:null,pickupWindows:JSON.parse(row.pickupWindows),accessNote:authorized?row.accessNote:'',confirmedAt:row.confirmedAt,expiresAt:row.expiresAt,validityDays:row.validityDays,revision:row.revision,needsConfirmation:['available','reserved','scheduled'].includes(row.status)&&needsConfirmation(row),planningReview:authorized?row.planningReview:false,canEdit:row.generatorUserId===user?.id&&['available','reserved','scheduled'].includes(row.status)};
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
 const pagePoints=filtered.slice((q.page-1)*q.limit,q.page*q.limit),chunks=[];for(let i=0;i<pagePoints.length;i+=80)chunks.push(pagePoints.slice(i,i+80).map(p=>p.id));
 const results=user?(await Promise.all(chunks.map(ids=>db.select().from(stopResults).where(inArray(stopResults.wastePointId,ids))))).flat():[];
 return {points:pagePoints.map(p=>({...serializeWaste(p,user,coop?.id),inProgress:running.has(p.id),results:user&&(p.generatorUserId===user.id||p.reservedBy===coop?.id||user.role==='admin')?results.filter(r=>r.wastePointId===p.id&&(p.generatorUserId===user.id||user.role==='admin'||r.cooperativeId===coop?.id)).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)):[]})),total:filtered.length,page:q.page,limit:q.limit};
}
export async function createWaste(db:Database,user:User,input:unknown,suggestedDays=7){
 requireUser(user,['generator','admin']);const {pickupWindows,revision,...d}=wasteSchema.parse(input),pointId=id(),at=now(),days=d.validityDays??defaultValidity(suggestedDays);
 const values={...d,pickupWindows:JSON.stringify(pickupWindows),validityDays:days,confirmedAt:at,expiresAt:expiry(at,days),id:pointId,generatorUserId:user.id,addressPublic:d.type==='Residência'?[d.region,d.city,d.state].join(', '):d.address,availabilityDate:d.availabilityDate??new Date(Date.now()+(d.availability==='Amanhã'?86400000:0)).toISOString().slice(0,10),status:'available' as const,createdAt:at,updatedAt:at};
 await db.batch([db.insert(wastePoints).values(values),audit(db,user.id,'waste.created','waste',pointId)]);return serializeWaste(await getWaste(db,pointId),user);
}
export async function editWaste(db:Database,user:User,pointId:string,input:unknown){
 const {pickupWindows,revision,...d}=wasteSchema.parse(input),p=await getWaste(db,pointId);if(p.generatorUserId!==user.id)throw new HttpError(403,'Você só pode editar seus próprios resíduos.');
 if(revision===undefined)throw new HttpError(409,'Atualize o anúncio antes de editar.');
 const at=now(),days=d.validityDays??p.validityDays;
 await atomic(db,sql`EXISTS(SELECT 1 FROM waste_points WHERE id=${pointId} AND generator_user_id=${user.id} AND revision=${revision} AND status IN ('available','reserved','scheduled')) AND NOT EXISTS(SELECT 1 FROM stop_results s JOIN routes r ON r.id=s.route_id WHERE s.waste_point_id=${pointId} AND r.status IN ('scheduled','in_progress'))`,[db.update(wastePoints).set({...d,pickupWindows:JSON.stringify(pickupWindows),validityDays:days,expiresAt:p.confirmedAt?expiry(p.confirmedAt,days):p.expiresAt,addressPublic:d.type==='Residência'?[d.region,d.city,d.state].join(', '):d.address,revision:revision+1,updatedAt:at}).where(eq(wastePoints.id,pointId)),audit(db,user.id,'waste.updated','waste',pointId)]);return serializeWaste(await getWaste(db,pointId),user);
}
export async function confirmWaste(db:Database,user:User,pointId:string,input:unknown){
 const p=await getWaste(db,pointId),d=confirmationSchema.parse(input);if(p.generatorUserId!==user.id)throw new HttpError(403,'Somente o gerador pode confirmar seu material.');
 const at=now(),days=d.validityDays??p.validityDays;
 await atomic(db,sql`EXISTS(SELECT 1 FROM waste_points WHERE id=${pointId} AND revision=${d.revision} AND status IN ('available','reserved','scheduled')) AND NOT EXISTS(SELECT 1 FROM stop_results s JOIN routes r ON r.id=s.route_id WHERE s.waste_point_id=${pointId} AND r.status IN ('scheduled','in_progress'))`,[db.update(wastePoints).set({confirmedAt:at,expiresAt:expiry(at,days),validityDays:days,revision:d.revision+1,updatedAt:at}).where(eq(wastePoints.id,pointId)),audit(db,user.id,'waste.confirmed','waste',pointId)]);return {ok:true};
}
export async function reserveWaste(db:Database,user:User,pointId:string){
 const coop=await ownCooperative(db,user),p=await getWaste(db,pointId);if(needsConfirmation(p))throw new HttpError(409,'Disponibilidade a confirmar: aguarde a confirmação do gerador.');const accepted=await db.select().from(cooperativeMaterials).where(eq(cooperativeMaterials.cooperativeId,coop.id));
 if(!accepted.some(m=>m.material===p.material))throw new HttpError(409,'Material não aceito por sua cooperativa.');if(p.kg>coop.capacityKg)throw new HttpError(409,'Quantidade acima da capacidade cadastrada.');if(calculateDistance(coop,getPublicCoordinates(p))>coop.radiusKm)throw new HttpError(409,'Ponto fora da área de atuação.');
 await atomic(db,sql`EXISTS(SELECT 1 FROM waste_points WHERE id=${pointId} AND status='available' AND location_confirmed=1 AND revision=${p.revision} AND (expires_at IS NULL OR (confirmed_at IS NOT NULL AND expires_at>strftime('%Y-%m-%dT%H:%M:%fZ','now')))) AND NOT EXISTS(SELECT 1 FROM route_points rp JOIN routes r ON r.id=rp.route_id WHERE rp.waste_point_id=${pointId} AND r.status IN ('draft','scheduled','in_progress'))`,[db.update(wastePoints).set({status:'reserved',reservedBy:coop.id,planningReview:false,revision:p.revision+1,updatedAt:now()}).where(eq(wastePoints.id,pointId)),audit(db,user.id,'waste.reserved','waste',pointId)]);return serializeWaste(await getWaste(db,pointId),user,coop.id);
}
export async function scheduleWaste(db:Database,user:User,pointId:string,input:unknown){
 const coop=await ownCooperative(db,user),d=scheduleSchema.parse(input),p=await getWaste(db,pointId);
 if(!compatibleWindow(JSON.parse(p.pickupWindows),d.date,d.timeWindow))throw new HttpError(409,'Janela incompatível com os horários deste ponto.');
 if(p.planningReview&&!d.review)throw new HttpError(409,'O material foi alterado. Revise os dados e confirme a revisão ao reagendar.');
 const accepted=await db.select().from(cooperativeMaterials).where(eq(cooperativeMaterials.cooperativeId,coop.id));if(p.kg>coop.capacityKg||!accepted.some(a=>a.material===p.material))throw new HttpError(409,'Revise a quantidade ou os materiais aceitos pela organização.');if(d.date<now().slice(0,10))throw new HttpError(400,'Escolha uma data a partir de hoje.');
 await atomic(db,sql`EXISTS(SELECT 1 FROM waste_points WHERE id=${pointId} AND reserved_by=${coop.id} AND status IN ('reserved','scheduled') AND revision=${p.revision}) AND ${dailyLoad(coop.id,d.date,[pointId])}+${p.kg}<=(SELECT daily_capacity_kg FROM cooperatives WHERE id=${coop.id}) AND NOT EXISTS(SELECT 1 FROM route_points rp JOIN routes r ON r.id=rp.route_id WHERE rp.waste_point_id=${pointId} AND r.status IN ('draft','scheduled','in_progress'))`,[db.update(wastePoints).set({status:'scheduled',scheduledDate:d.date,timeWindow:d.timeWindow,scheduleNote:d.note,planningReview:false,revision:p.revision+1,updatedAt:now()}).where(eq(wastePoints.id,pointId)),audit(db,user.id,'collection.scheduled','waste',pointId)]);return serializeWaste(await getWaste(db,pointId),user,coop.id);
}
export async function releaseWaste(db:Database,user:User,pointId:string){
 const coop=await ownCooperative(db,user),p=await getWaste(db,pointId);
 await atomic(db,sql`EXISTS(SELECT 1 FROM waste_points WHERE id=${pointId} AND reserved_by=${coop.id} AND status IN ('reserved','scheduled','cancelled') AND revision=${p.revision}) AND NOT EXISTS(SELECT 1 FROM route_points rp JOIN routes r ON r.id=rp.route_id WHERE rp.waste_point_id=${pointId} AND r.status IN ('draft','scheduled','in_progress'))`,[db.update(wastePoints).set({status:p.status==='cancelled'?'cancelled':'available',reservedBy:null,scheduledDate:null,timeWindow:null,scheduleNote:null,planningReview:false,revision:p.revision+1,updatedAt:now()}).where(eq(wastePoints.id,pointId)),audit(db,user.id,'reservation.cancelled','waste',pointId)]);return {ok:true};
}
export async function runningPointIds(db:Database){return new Set((await db.select({id:routePoints.wastePointId}).from(routePoints).innerJoin(routes,eq(routes.id,routePoints.routeId)).where(eq(routes.status,'in_progress'))).map(r=>r.id));}
export async function cancelWaste(db:Database,user:User,pointId:string){
 const p=await getWaste(db,pointId);if(p.generatorUserId!==user.id&&user.role!=='admin')throw new HttpError(403,'Você não pode retirar este material.');
 await atomic(db,sql`EXISTS(SELECT 1 FROM waste_points WHERE id=${pointId} AND revision=${p.revision} AND status IN ('available','reserved','scheduled'))`,[db.update(wastePoints).set({status:'cancelled',revision:p.revision+1,updatedAt:now()}).where(eq(wastePoints.id,pointId)),audit(db,user.id,'waste.cancelled','waste',pointId)]);return {ok:true};
}
export async function saveCooperative(db:Database,user:User,input:unknown){
 requireUser(user,['cooperative','collector','admin']);const d=cooperativeSchema.parse(input),[existing]=await db.select().from(cooperatives).where(eq(cooperatives.ownerUserId,user.id)),coopId=existing?.id??id(),at=now();const {acceptedMaterials,...data}=d;
 await db.batch([db.insert(cooperatives).values({...data,id:coopId,ownerUserId:user.id,createdAt:at,updatedAt:at}).onConflictDoUpdate({target:cooperatives.ownerUserId,set:{...data,updatedAt:at}}),db.delete(cooperativeMaterials).where(eq(cooperativeMaterials.cooperativeId,coopId)),...acceptedMaterials.map(material=>db.insert(cooperativeMaterials).values({cooperativeId:coopId,material})),audit(db,user.id,'cooperative.updated','cooperative',coopId)] as Parameters<Database['batch']>[0]);return getCooperative(db,user);
}
export async function getCooperative(db:Database,user:User):Promise<(Cooperative&{city:string;state:string;description:string})|null>{
 const [c]=await db.select().from(cooperatives).where(eq(cooperatives.ownerUserId,user.id));if(!c)return null;const accepted=await db.select().from(cooperativeMaterials).where(eq(cooperativeMaterials.cooperativeId,c.id));return {...c,source:'registered',acceptedMaterials:accepted.map(x=>x.material)};
}
export async function getProfile(db:Database,user:User){const [p]=await db.select().from(profiles).where(eq(profiles.userId,user.id));return p;}
