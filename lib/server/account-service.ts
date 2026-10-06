import {eq,sql} from 'drizzle-orm';
import {z} from 'zod';
import bcrypt from 'bcryptjs';
import type {Database} from '@/db';
import {users,profiles,sessions,accountPreferences,type User} from '@/db/schema';
import {atomic,audit,HttpError,now} from './security';
import {planAccess} from './plan-service';
import {defaultPreferences,type Preferences} from '../preferences';
const profileSchema=z.object({name:z.string().trim().min(1).max(100),phone:z.string().trim().max(30),city:z.string().trim().min(1).max(100),state:z.string().trim().min(1).max(50),version:z.string().max(50)}).strict();
const preferencesSchema=z.object({theme:z.enum(['light','dark','system']),reduceMotion:z.boolean(),notifications:z.object({scheduling:z.boolean(),changes:z.boolean(),confirmation:z.boolean(),results:z.boolean()}).strict(),revision:z.number().int().min(0)}).strict();
const passwordSchema=z.object({currentPassword:z.string().min(1).max(72),newPassword:z.string().min(12).max(72).refine(s=>new TextEncoder().encode(s).length<=72,'Senha deve ter até 72 bytes.')}).strict();
export async function getPreferences(db:Database,user:User):Promise<Preferences>{
 const [p]=await db.select().from(accountPreferences).where(eq(accountPreferences.userId,user.id));
 return p?{theme:p.theme,reduceMotion:p.reduceMotion,notifications:{...defaultPreferences.notifications,...JSON.parse(p.notifications)},revision:p.revision}:{...defaultPreferences};
}
export async function getAccount(db:Database,user:User){const [profile]=await db.select().from(profiles).where(eq(profiles.userId,user.id));return {user:{id:user.id,name:user.name,email:user.email,role:user.role},profile:profile??null,version:user.updatedAt,preferences:await getPreferences(db,user),access:await planAccess(db,user)};}
export async function editProfile(db:Database,user:User,input:unknown){
 const d=profileSchema.parse(input);
 await atomic(db,sql`EXISTS(SELECT 1 FROM users WHERE id=${user.id} AND updated_at=${d.version})`,[
 db.update(users).set({name:d.name,updatedAt:now()}).where(eq(users.id,user.id)),
 db.update(profiles).set({phone:d.phone||null,city:d.city,state:d.state}).where(eq(profiles.userId,user.id)),audit(db,user.id,'profile.updated','user',user.id)]);
 const [updated]=await db.select().from(users).where(eq(users.id,user.id));return getAccount(db,updated);
}
export async function savePreferences(db:Database,user:User,input:unknown){
 const d=preferencesSchema.parse(input);
 await atomic(db,sql`COALESCE((SELECT revision FROM account_preferences WHERE user_id=${user.id}),0)=${d.revision}`,[
 db.insert(accountPreferences).values({userId:user.id,theme:d.theme,reduceMotion:d.reduceMotion,notifications:JSON.stringify(d.notifications),revision:d.revision+1}).onConflictDoUpdate({target:accountPreferences.userId,set:{theme:d.theme,reduceMotion:d.reduceMotion,notifications:JSON.stringify(d.notifications),revision:d.revision+1}}),audit(db,user.id,'preferences.updated','user',user.id)]);
 return getPreferences(db,user);
}
export async function changePassword(db:Database,user:User,input:unknown){
 const d=passwordSchema.parse(input);
 if(!await bcrypt.compare(d.currentPassword,user.passwordHash))throw new HttpError(403,'Senha atual incorreta.');
 if(d.currentPassword===d.newPassword)throw new HttpError(400,'Escolha uma senha diferente da atual.');
 const passwordHash=await bcrypt.hash(d.newPassword,12);
 await atomic(db,sql`EXISTS(SELECT 1 FROM users WHERE id=${user.id} AND password_hash=${user.passwordHash})`,[
 db.update(users).set({passwordHash,updatedAt:now()}).where(eq(users.id,user.id)),
 db.delete(sessions).where(eq(sessions.userId,user.id)),audit(db,user.id,'password.changed_sessions_revoked','user',user.id)]);
 return {ok:true};
}
