import {and,eq,or} from 'drizzle-orm';
import type {Database} from '@/db';
import {wastePoints,type User} from '@/db/schema';
import {getCooperative,serializeWaste} from './waste-service';
import {generationHistory,collectionHistory} from './report-service';
import {listRoutes} from './route-service';
import {opportunities} from '../logistics';
import {calculateDistance,visibleLocation,hasDefinedLocation} from '../geo';
export async function intelligence(db:Database,user:User){
 const coop=await getCooperative(db,user),operator=['cooperative','collector'].includes(user.role);
 const rows=await db.select().from(wastePoints).where(or(eq(wastePoints.status,'available'),eq(wastePoints.generatorUserId,user.id),...(coop?[eq(wastePoints.reservedBy,coop.id)]:[])));
 const points=rows.map(p=>serializeWaste(p,user,coop?.id));
 const history=operator&&!coop?[]:await generationHistory(db,user),collected=operator&&!coop?[]:await collectionHistory(db,user,'7'),routes=coop?await listRoutes(db,user):[];
 const groups=opportunities(points,coop,history),available=points.filter(p=>p.status==='available'&&hasDefinedLocation(p)&&!!coop&&calculateDistance(coop,visibleLocation(p))<=coop.radiusKm);
 return {groups,history,points,summary:{availableKg:available.reduce((s,p)=>s+p.kg,0),availablePoints:available.length,reservedKg:points.filter(p=>p.reservedBy===coop?.id&&p.status==='reserved').reduce((s,p)=>s+p.kg,0),scheduledKg:points.filter(p=>p.reservedBy===coop?.id&&p.status==='scheduled').reduce((s,p)=>s+p.kg,0),collected7Kg:collected.reduce((s,c)=>s+c.kg,0),openRoutes:routes.filter(r=>['draft','scheduled','in_progress'].includes(r.status)).length,scheduledRoutes:routes.filter(r=>r.status==='scheduled').length,opportunities:groups.filter(g=>g.reservableCount>0).length},upcoming:routes.filter(r=>['scheduled','in_progress'].includes(r.status)).sort((a,b)=>(a.scheduledDate??'').localeCompare(b.scheduledDate??'')).map(r=>({...r,regions:[...new Set(r.points.map(p=>points.find(q=>q.id===p.id)?.region).filter(Boolean))]}))};
}
