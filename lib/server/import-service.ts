import {z} from 'zod';
import {eq,and} from 'drizzle-orm';
import type {Database} from '@/db';
import {legacyImports,wastePoints,collections,collectionItems,type User} from '@/db/schema';
import {id,now,digest,audit,HttpError} from './security';
import {wasteSchema} from './schemas';
const legacyPoint=wasteSchema.omit({locationConfirmed:true}).extend({id:z.string().min(1).max(150),source:z.literal('registered'),status:z.enum(['available','collected']),coordinateKind:z.enum(['registered','schematic']),locationConfirmed:z.boolean().optional(),city:z.string().max(100).default(''),state:z.string().max(50).default(''),createdAt:z.string().datetime()}).passthrough();
const importSchema=z.object({registered:z.object({points:z.array(legacyPoint).max(500),collections:z.array(z.object({id:z.string().max(150),date:z.string(),kg:z.number().finite().positive(),points:z.array(legacyPoint).max(500)}).passthrough()).max(500),plan:z.unknown().nullable(),cooperative:z.unknown().optional()}),validation:z.unknown().optional()}).strict();
async function stableId(userId:string,key:string){const hash=await digest(userId+':'+key);return `${hash.slice(0,8)}-${hash.slice(8,12)}-4${hash.slice(13,16)}-a${hash.slice(17,20)}-${hash.slice(20,32)}`;}
export async function importLegacy(db:Database,user:User,input:unknown){
 const data=importSchema.parse(input),payload=JSON.stringify(data),checksum=await digest(payload),[previous]=await db.select().from(legacyImports).where(and(eq(legacyImports.userId,user.id),eq(legacyImports.checksum,checksum)));
 if(previous)return {id:previous.id,alreadyImported:true};
 const importId=id(),at=now(),all=[...data.registered.collections.flatMap(c=>c.points),...data.registered.points],unique=[...new Map(all.map(p=>[p.id,p])).values()];
 const queries:[...Parameters<Database['batch']>[0]]=[db.insert(legacyImports).values({id:importId,userId:user.id,checksum,payload,createdAt:at})];
 for(const p of unique){if(p.id.startsWith('sample-')||p.id.startsWith('demo-'))throw new HttpError(400,'Dados demonstrativos não podem ser importados como reais.');const pointId=await stableId(user.id,'point:'+p.id);queries.push(db.insert(wastePoints).values({id:pointId,generatorUserId:user.id,name:p.name,type:p.type,material:p.material,kg:p.kg,lat:p.lat,lng:p.lng,address:p.address,addressPublic:p.type==='Residência'?[p.region,p.city,p.state].join(', '):p.address,street:p.street,number:p.number,postcode:p.postcode,region:p.region,city:p.city,state:p.state,availability:p.availability,availabilityDate:p.availabilityDate??p.createdAt.slice(0,10),frequency:p.frequency,status:p.status,locationConfirmed:p.coordinateKind==='registered'&&p.locationConfirmed!==false,legacyKey:user.id+':'+p.id,createdAt:p.createdAt,updatedAt:at}).onConflictDoNothing());}
 for(const c of data.registered.collections){const collectionId=await stableId(user.id,'collection:'+c.id);queries.push(db.insert(collections).values({id:collectionId,date:c.date.slice(0,10),status:'legacy',totalWeightKg:null,legacyOwnerId:user.id,createdAt:at}).onConflictDoNothing());for(const p of c.points)queries.push(db.insert(collectionItems).values({id:await stableId(user.id,'item:'+p.id),collectionId,wastePointId:await stableId(user.id,'point:'+p.id),estimatedWeight:p.kg,actualWeight:null,collectedAt:c.date.slice(0,10)}).onConflictDoNothing());}
 queries.push(audit(db,user.id,'legacy.imported','import',importId));
 // D1's batch is transactional: do not clear browser data before this resolves successfully.
 await db.batch(queries);return {id:importId,points:unique.length,legacyCollections:data.registered.collections.length};
}
export async function importedArchives(db:Database,user:User){return db.select({id:legacyImports.id,payload:legacyImports.payload,createdAt:legacyImports.createdAt}).from(legacyImports).where(eq(legacyImports.userId,user.id));}
