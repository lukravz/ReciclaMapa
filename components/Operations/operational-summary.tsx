import type {intelligence} from '@/lib/server/intelligence-service';
import {num,materials} from '@/lib/model';
import {statusLabel} from '@/lib/api-client';
import {HistoryCards} from './recurrence';
export type Intelligence=Awaited<ReturnType<typeof intelligence>>;
export default function OperationalSummary({data}:{data:Intelligence}){
 const s=data.summary;
 return <section className="section-gap"><h2>Resumo operacional</h2><div className="stats section-gap">{[['Disponível na área',num(s.availableKg)+' kg'],['Pontos na área',s.availablePoints],['Reservados',num(s.reservedKg)+' kg'],['Agendados',num(s.scheduledKg)+' kg'],['Coletados nos últimos 7 dias',num(s.collected7Kg)+' kg reais'],['Rotas abertas',s.openRoutes],['Rotas agendadas',s.scheduledRoutes],['Oportunidades encontradas',s.opportunities]].map(([label,value])=><article className="stat" key={label}><div className="stat-label">{label}</div><div className="stat-value">{value}</div></article>)}</div><section className="panel form-body"><h3>Materiais predominantes disponíveis</h3><div className="material-tags">{materials(data.points.filter(p=>p.status==='available')).map(m=><span key={m.name}>{m.name} · {num(m.kg)} kg</span>)}</div></section><section className="panel form-body section-gap"><h3>Próximas coletas</h3>{!data.upcoming.length&&<p>Nenhuma coleta agendada.</p>}{data.upcoming.map(r=><article key={r.id} className="upcoming"><b>{r.scheduledDate} · {r.timeWindow}</b><p>{r.regions.join(', ')} · {r.points.length} paradas · {num(r.totalWeightKg)} kg estimados</p><span>{statusLabel[r.status]}</span></article>)}</section><h3 className="section-gap">Fontes recorrentes</h3><HistoryCards history={data.history}/></section>;
}
