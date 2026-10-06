import {eq,sql} from 'drizzle-orm';
import type {Database} from '@/db';
import {accountPlans,organizationPlans,cooperatives,type User} from '@/db/schema';
import {accessFor,featureAllowed,FEATURES,PLANS,type Feature} from '../plans';
import {HttpError} from './security';
export async function planAccess(db:Database,user:User){
 const [organization]=await db.select({id:cooperatives.id}).from(cooperatives).where(eq(cooperatives.ownerUserId,user.id));
 if(organization){const [row]=await db.select().from(organizationPlans).where(eq(organizationPlans.cooperativeId,organization.id));return accessFor(row?.plan??'free',row?.legacy??false,organization.id);}
 const [row]=await db.select().from(accountPlans).where(eq(accountPlans.userId,user.id));return accessFor(row?.plan??'free',row?.legacy??false);
}
export async function requireFeature(db:Database,user:User,feature:Feature){
 const access=await planAccess(db,user),definition=FEATURES[feature];
 if(!definition.ready)throw new HttpError(409,'Recurso em desenvolvimento.');
 if(!access.features[feature])throw new HttpError(403,'Disponível no '+PLANS[definition.plan].name+'. Consulte a página Planos.');
 return access;
}
// Re-check the persisted entitlement and active-route count inside the write transaction.
export function routeCreationAllowed(cooperativeId:string){
 const plans=Object.keys(PLANS).filter(p=>featureAllowed(p as keyof typeof PLANS,false,'parallelRoutes'));
 return sql`(EXISTS(SELECT 1 FROM organization_plans WHERE cooperative_id=${cooperativeId} AND (plan IN (${sql.join(plans.map(p=>sql`${p}`),sql`,`)}) OR (legacy_access=1 AND ${FEATURES.parallelRoutes.legacy?1:0}=1))) OR NOT EXISTS(SELECT 1 FROM routes WHERE cooperative_id=${cooperativeId} AND status IN ('draft','scheduled','in_progress')))`;
}
