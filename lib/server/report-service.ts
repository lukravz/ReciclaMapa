import {summarizeHistory} from '../history';
import {eq,and,sql,desc,inArray} from 'drizzle-orm';
import type {Database} from '@/db';
import {collections,collectionItems,wastePoints,routes,cooperatives,validationInterviews,auditLogs,users,type User} from '@/db/schema';
import {ownCooperative,serializeWaste} from './waste-service';
import {interviewSchema} from './schemas';
import {requireUser,now,id,audit,HttpError} from './security';
import type {Collection,RouteComparison} from '@/types';
export async function collectionHistory(db:Database,user:User,period='all'):Promise<Collection[]>{
 if(!['today','7','30','all'].includes(period))throw new HttpError(400,'Período inválido.');
 const coop=['cooperative','collector'].includes(user.role)?await ownCooperative(db,user):null;
 const conditions=[eq(collections.status,'completed')];
 if(user.role==='generator')conditions.push(eq(wastePoints.generatorUserId,user.id));else if(coop)conditions.push(eq(collections.cooperativeId,coop.id));
 if(period!=='all'){const days=period==='today'?0:Number(period)-1;conditions.push(sql`${collections.date}>=${new Date(Date.now()-days*86400000).toISOString().slice(0,10)}`);}
 const rows=await db.select({collection:collections,item:collectionItems,point:wastePoints,route:routes}).from(collections).innerJoin(collectionItems,eq(collectionItems.collectionId,collections.id)).innerJoin(wastePoints,eq(wastePoints.id,collectionItems.wastePointId)).leftJoin(routes,eq(routes.id,collections.routeId)).where(and(...conditions)).orderBy(desc(collections.date));
 const groups=new Map<string,Collection>();
 for(const row of rows){if(row.item.actualWeight===null)continue;let group=groups.get(row.collection.id);if(!group){group={id:row.collection.id,date:row.collection.date,kg:0,points:[],...(user.role!=='generator'&&row.collection.totalDistanceKm!==null?{actualDistanceKm:row.collection.totalDistanceKm}:{}),...(user.role!=='generator'&&row.route?.comparison?{route:JSON.parse(row.route.comparison) as RouteComparison}:{})};groups.set(group.id,group);}group.kg+=row.item.actualWeight;group.points.push({...serializeWaste(row.point,user,coop?.id),kg:row.item.actualWeight});}
 return [...groups.values()];
}
export async function impact(db:Database,user:User,period:string){
 const history=await collectionHistory(db,user,period),routed=history.filter(c=>c.route),before=routed.reduce((s,c)=>s+c.route!.original.distanceKm,0),after=routed.reduce((s,c)=>s+c.route!.suggested.distanceKm,0);
 return {collections:history,collectedKg:history.reduce((s,c)=>s+c.kg,0),pointsServed:new Set(history.flatMap(c=>c.points.map(p=>[p.ownerId,p.name,p.region].join('|')))).size,completedCollections:history.length,comparedRoutes:routed.length,originalKm:routed.length?before:null,optimizedKm:routed.length?after:null,reducedKm:routed.length?Math.max(0,before-after):null,reportedDistanceKm:history.some(c=>c.actualDistanceKm!==undefined)?history.reduce((s,c)=>s+(c.actualDistanceKm??0),0):null};
}
export async function generationHistory(db:Database,user:User){
 const coop=['collector','cooperative'].includes(user.role)?await ownCooperative(db,user):null;
 const points=await db.select().from(wastePoints).where(user.role==='admin'?undefined:coop?eq(wastePoints.reservedBy,coop.id):eq(wastePoints.generatorUserId,user.id)).orderBy(wastePoints.createdAt);
 const groups=new Map<string,typeof points>();for(const p of points){if(p.frequency==='Única'||p.status==='cancelled')continue;const key=[p.generatorUserId,p.name.toLowerCase(),p.material,p.city.trim().toLowerCase(),p.state.trim().toLowerCase(),p.region.toLowerCase()].join('|');groups.set(key,[...(groups.get(key)??[]),p]);}
 return Promise.all([...groups.values()].map(async records=>{const p=records.at(-1)!,history=records.map(r=>({date:r.createdAt,kg:r.kg,status:r.status})),stats=summarizeHistory(history,p.frequency);
 const [last]=await db.select({date:collectionItems.collectedAt}).from(collectionItems).where(inArray(collectionItems.wastePointId,records.map(r=>r.id))).orderBy(desc(collectionItems.collectedAt)).limit(1);
 return {...stats,name:p.type==='Residência'&&p.generatorUserId!==user.id&&user.role!=='admin'?'Gerador residencial':p.name,material:p.material,region:p.region,frequency:p.frequency,records:history,point:serializeWaste(p,user,coop?.id),lastCollection:last?.date??null};}));
}
export async function validationReport(db:Database,user:User){requireUser(user,['admin']);const interviews=await db.select().from(validationInterviews).orderBy(desc(validationInterviews.createdAt));return {interviews,total:interviews.length,byType:Object.fromEntries(['collector','cooperative','business','resident'].map(t=>[t,interviews.filter(i=>i.intervieweeType===t).length])),wouldUsePercent:interviews.length?interviews.filter(i=>i.wouldUse==='yes').length/interviews.length*100:null,problems:interviews.map(i=>i.mainProblem)};}
export async function addInterview(db:Database,user:User,input:unknown){requireUser(user,['admin']);const d=interviewSchema.parse(input),interviewId=id();await db.batch([db.insert(validationInterviews).values({...d,id:interviewId,createdBy:user.id,createdAt:now()}),audit(db,user.id,'interview.created','validation',interviewId)]);return {id:interviewId};}
export async function adminReport(db:Database,user:User){requireUser(user,['admin']);const counts=await db.select({users:sql<number>`(SELECT COUNT(*) FROM users)`,cooperatives:sql<number>`(SELECT COUNT(*) FROM cooperatives)`,waste:sql<number>`(SELECT COUNT(*) FROM waste_points)`,collections:sql<number>`(SELECT COUNT(*) FROM collections WHERE total_weight_kg IS NOT NULL)`}).from(users).limit(1);return {counts:counts[0],audit:await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(100)};}
