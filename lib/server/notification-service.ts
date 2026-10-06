import {and,eq,isNull,desc,sql} from 'drizzle-orm';
import type {Database} from '@/db';
import {notifications,type User} from '@/db/schema';
import {getPreferences} from './account-service';
import {notificationVisible} from '../preferences';
import {HttpError,now} from './security';
export async function listNotifications(db:Database,user:User){
 const items=await db.select().from(notifications).where(eq(notifications.userId,user.id)).orderBy(desc(notifications.createdAt)).limit(100);
 const [count]=await db.select({value:sql<number>`count(*)`}).from(notifications).where(and(eq(notifications.userId,user.id),isNull(notifications.readAt)));
 const prefs=await getPreferences(db,user),visible=items.filter(n=>notificationVisible(n.type,prefs));
 // Preferences affect the bell only. Every event remains queryable in this history.
 return {items:visible,allItems:items,unread:visible.filter(n=>!n.readAt).length,totalUnread:count.value};
}
export async function readNotification(db:Database,user:User,id?:string){
 const rows=await db.update(notifications).set({readAt:now()}).where(and(eq(notifications.userId,user.id),...(id?[eq(notifications.id,id)]:[isNull(notifications.readAt)]))).returning({id:notifications.id});
 if(id&&!rows.length)throw new HttpError(404,'Notificação não encontrada.');return {ok:true};
}
