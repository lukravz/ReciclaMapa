import type {LucideIcon} from 'lucide-react';
import {PackageOpen} from 'lucide-react';
import {num,type Mode} from '@/lib/model';
export function DataBadge({mode}:{mode:Mode|'estimate'|'validation'|'road'|'location'}){return <span className={`badge ${mode}`}>{mode==='simulated'?'Dado demonstrativo':mode==='registered'?'Dado cadastrado':mode==='estimate'?'Estimativa calculada':mode==='road'?'Rota real':mode==='location'?'Localização real':'Dado de validação real'}</span>}
export function Stats({items}:{items:{title:string;value:number;unit:string;icon:LucideIcon;desc:string}[]}){return <div className="stats">{items.map(s=><article className="stat" key={s.title}><div className="stat-label">{s.title}<s.icon size={19}/></div><div className="stat-value">{num(s.value)}<small>{s.unit}</small></div><p>{s.desc}</p></article>)}</div>}
export function Empty({title='Nenhum ponto disponível',text='Cadastre um resíduo para começar.',action}:{title?:string;text?:string;action?:React.ReactNode}){return <div className="empty"><PackageOpen size={32}/><h3>{title}</h3><p>{text}</p>{action}</div>}
export function PanelTitle({title,subtitle,action}:{title:string;subtitle?:string;action?:React.ReactNode}){return <div className="panel-heading"><div><h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div>{action}</div>}
