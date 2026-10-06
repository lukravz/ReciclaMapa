import type {Database} from '@/db';
import type {User} from '@/db/schema';
import {collectionHistory} from './report-service';
import {ownCooperative} from './waste-service';
import {OUTCOMES} from '../collection-reliability';
export function csvCell(value:unknown){let text=String(value??'');if(/^[=+@\-\t\r]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';}
export async function organizationExport(db:Database,user:User,period:string){
 await ownCooperative(db,user);
 const history=await collectionHistory(db,user,period),rows:unknown[][]=[['Data','Rota','Material','Região','Resultado','Estimado (kg)','Coletado (kg)','Restante estimado (kg)','Origem']];
 for(const c of history)for(const result of c.results??[]){const p=c.points.find(p=>p.id===result.wastePointId);rows.push([result.date,c.routeId??'Avulsa',p?.material,p?.region,OUTCOMES[result.outcome],result.estimatedWeight,result.actualWeight,result.remainingKg,'Dados reais']);}
 return '\uFEFF'+rows.map(row=>row.map(csvCell).join(';')).join('\r\n');
}
export async function organizationProductivity(db:Database,user:User,period:string){
 await ownCooperative(db,user);
 const history=await collectionHistory(db,user,period),results=history.flatMap(c=>c.results??[]),completed=history.filter(c=>c.routeId&&c.completed!==false);
 return {stops:results.length,completedRoutes:completed.length,kgPerCompletedRoute:completed.length?completed.reduce((sum,c)=>sum+c.kg,0)/completed.length:0};
}
