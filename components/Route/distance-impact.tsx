import {Route,Milestone,TrendingDown,Navigation} from 'lucide-react';
import type {Workspace} from '@/types';
import {num} from '@/lib/model';
export default function DistanceImpact({workspace}:{workspace:Workspace}) {
  const routed=workspace.collections.filter(c=>c.route?.original.provider==='OSRM'&&c.route?.suggested.provider==='OSRM');
  const before=routed.reduce((s,c)=>s+c.route!.original.distanceKm,0),after=routed.reduce((s,c)=>s+c.route!.suggested.distanceKm,0);
  const reported=workspace.collections.filter(c=>typeof c.actualDistanceKm==='number');
  const items=[{label:'Rotas concluídas',value:String(workspace.collections.length),unit:'rotas',Icon:Route,note:`${routed.length} com comparação viária`},{label:'Ordem original',value:routed.length?num(before):'—',unit:'km',Icon:Milestone,note:'Ordem original · OSRM'},{label:'Km planejados (rota sugerida)',value:routed.length?num(after):'—',unit:'km',Icon:Navigation,note:'Distância planejada · OSRM'},{label:'Redução viária calculada',value:routed.length?num(Math.max(0,before-after)):'—',unit:'km',Icon:TrendingDown,note:'Diferença entre rotas viárias calculadas'}];
  return <section className="section-gap"><div className="stats">{items.map(({label,value,unit,Icon,note})=><article className="stat" key={label}><div className="stat-label">{label}<Icon size={19}/></div><div className="stat-value">{value}<small>{unit}</small></div><p>{note}</p></article>)}</div><div className="notice"><Navigation size={21}/><div><b>Distância total percorrida: {reported.length?`${num(reported.reduce((s,c)=>s+c.actualDistanceKm!,0))} km informados`:'não informada'}</b><p>{reported.length} de {workspace.collections.length} coletas com leitura de percurso. O sistema não rastreia GPS. Distâncias do OSRM são estimativas planejadas; coletas antigas sem rota não entram na comparação.</p></div></div></section>;
}
