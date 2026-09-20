import {demoWorkspace,completeCollection} from './model.ts';
import type {Workspace,RouteComparison} from '../types/index.ts';
export const DEMO_IDS=['sample-0','sample-1','sample-2','sample-3'];
export function demoAtStage(stage:number,comparison?:RouteComparison|null):Workspace{
 const w=demoWorkspace();if(stage<6)return w;
 if(!comparison)throw new Error('Calcule a rota antes de simular reservas e coleta.');
 const plan={ids:comparison.suggestedIds,originalIds:comparison.originalIds,date:new Date().toISOString().slice(0,10),optimized:true,comparison};
 if(stage>=9)return completeCollection({...w,plan},DEMO_IDS);
 return {...w,plan,points:w.points.map(p=>DEMO_IDS.includes(p.id)?{...p,status:stage>=7?'scheduled':'reserved',reservedBy:w.cooperative!.id,scheduledDate:stage>=7?plan.date:null,timeWindow:stage>=7?'14h–16h':null,inProgress:stage===8}:p)};
}
