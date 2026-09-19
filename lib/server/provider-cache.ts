import {eq,sql} from 'drizzle-orm';
import {database} from '@/db';
import {providerCache,providerLocks} from '@/db/schema';
import {digest,HttpError} from './security';
export async function sharedProviderCall<T>(provider:string,key:string,ttl:number,execute:()=>Promise<T>):Promise<T>{
 const {db}=await database(),hash=await digest(provider+':'+key),time=Date.now();
 const [cached]=await db.select().from(providerCache).where(eq(providerCache.key,hash));if(cached&&cached.expiresAt>time)return JSON.parse(cached.payload) as T;
 const [lease]=await db.insert(providerLocks).values({provider,nextAllowed:time+1100}).onConflictDoUpdate({target:providerLocks.provider,set:{nextAllowed:time+1100},setWhere:sql`${providerLocks.nextAllowed}<=${time}`}).returning();
 if(!lease)throw new HttpError(429,'Outra consulta de mapas está em andamento. Aguarde dois segundos e tente novamente.');
 const value=await execute();await db.insert(providerCache).values({key:hash,payload:JSON.stringify(value),expiresAt:time+ttl}).onConflictDoUpdate({target:providerCache.key,set:{payload:JSON.stringify(value),expiresAt:time+ttl}});
 await db.delete(providerCache).where(sql`${providerCache.expiresAt}<${time}`);return value;
}
