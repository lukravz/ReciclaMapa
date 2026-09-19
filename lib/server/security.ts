import {eq,and,sql} from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import type {Database} from '@/db';
import {sessions,users,profiles,rateLimits,auditLogs,operationGuards,type User} from '@/db/schema';
export class HttpError extends Error { status:number; constructor(status:number,message:string){super(message);this.status=status;} }
export const now=()=>new Date().toISOString();
export const id=()=>crypto.randomUUID();
export const publicUser=(u:User)=>({id:u.id,name:u.name,email:u.email,role:u.role});
export async function digest(value:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(b=>b.toString(16).padStart(2,'0')).join('');}
export function checkOrigin(request:Request,env:CloudflareEnv){
 if(['GET','HEAD','OPTIONS'].includes(request.method))return;
 const origin=request.headers.get('origin'),expected=env.APP_ORIGIN||new URL(request.url).origin;
 if(!origin||origin!==expected||request.headers.get('sec-fetch-site')==='cross-site')throw new HttpError(403,'Origem da solicitação não autorizada.');
 if(!request.headers.get('content-type')?.includes('application/json'))throw new HttpError(415,'Envie JSON.');
}
export async function bodyJson(request:Request){const raw=await request.text();if(raw.length>2_000_000)throw new HttpError(413,'Conteúdo muito grande.');try{return JSON.parse(raw);}catch{throw new HttpError(400,'JSON inválido.');}}
export async function limit(db:Database,key:string,max:number,windowSeconds:number){
 const time=Math.floor(Date.now()/1000),slot=Math.floor(time/windowSeconds),bucket=await digest(key+':'+slot);
 const [row]=await db.insert(rateLimits).values({key:bucket,count:1,expiresAt:time+windowSeconds*2}).onConflictDoUpdate({target:rateLimits.key,set:{count:sql`${rateLimits.count}+1`}}).returning();
 if(row.count>max)throw new HttpError(429,'Muitas solicitações. Aguarde alguns minutos e tente novamente.');
 // Amortized cleanup, with no personal data stored in the key.
 if(row.count===1&&Math.random()<.05)await db.delete(rateLimits).where(sql`${rateLimits.expiresAt}<${time}`);
}
export async function sessionUser(db:Database,request:Request){
 const token=request.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith('recicla_session='))?.slice(16);
 if(!token||!/^[a-f0-9]{64}$/.test(token))return null;
 const [row]=await db.select({user:users}).from(sessions).innerJoin(users,eq(users.id,sessions.userId)).where(and(eq(sessions.tokenHash,await digest(token)),sql`${sessions.expiresAt}>${Date.now()}`));return row?.user??null;
}
export function requireUser(user:User|null,roles?:User['role'][]){if(!user)throw new HttpError(401,'Entre na sua conta para continuar.');if(roles&&!roles.includes(user.role))throw new HttpError(403,'Seu perfil não tem acesso a esta ação.');return user;}
export function sessionCookie(token:string,request:Request,clear=false){return `recicla_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${clear?0:604800}${new URL(request.url).protocol==='https:'?'; Secure':''}`;}
export async function createSession(db:Database,userId:string){const token=Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b=>b.toString(16).padStart(2,'0')).join('');await db.insert(sessions).values({tokenHash:await digest(token),userId,expiresAt:Date.now()+604800000,createdAt:now()});return token;}
export async function logout(db:Database,request:Request){const token=request.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith('recicla_session='))?.slice(16);if(token)await db.delete(sessions).where(eq(sessions.tokenHash,await digest(token)));}
export const audit=(db:Database,userId:string,action:string,entityType:string,entityId:string)=>db.insert(auditLogs).values({id:id(),userId,action,entityType,entityId,createdAt:now()});
export async function atomic(db:Database,condition:ReturnType<typeof sql>,queries:Parameters<Database['batch']>[0]){
 const operation=id();
 try{return await db.batch([db.insert(operationGuards).values({id:operation,ok:sql`CASE WHEN ${condition} THEN 1 ELSE 0 END`}),...queries,db.delete(operationGuards).where(eq(operationGuards.id,operation))] as Parameters<Database['batch']>[0]);}
 catch(error){if([error,(error as Error & {cause?:unknown}).cause,((error as Error & {cause?:Error}).cause as Error & {cause?:unknown})?.cause].some(e=>String(e).includes('operation_precondition')))throw new HttpError(409,'Este registro foi alterado por outra operação. Atualize a página e tente novamente.');throw error;}
}
export async function register(db:Database,data:{name:string;email:string;password:string;role:'generator'|'cooperative'|'collector';city:string;state:string;neighborhood:string}){
 const userId=id(),at=now(),passwordHash=await bcrypt.hash(data.password,12);
 try{await db.batch([db.insert(users).values({id:userId,name:data.name,email:data.email,passwordHash,role:data.role,createdAt:at,updatedAt:at}),db.insert(profiles).values({id:id(),userId,city:data.city,state:data.state,neighborhood:data.neighborhood,profileType:data.role,createdAt:at}),audit(db,userId,'user.created','user',userId)]);}catch(error){if(String(error).includes('UNIQUE'))throw new HttpError(409,'Este e-mail já possui uma conta.');throw error;}
 const [user]=await db.select().from(users).where(eq(users.id,userId));return user;
}
export async function login(db:Database,email:string,password:string){
 const [user]=await db.select().from(users).where(eq(users.email,email));
 const hash=user?.passwordHash??'$2b$12$8Gi.0fZARaqFkLlUPU4XL.HT2.vmgPdEj.2urEMD9Je.Y5wyMbEDe';
 if(!await bcrypt.compare(password,hash)||!user)throw new HttpError(401,'E-mail ou senha inválidos.');return user;
}
