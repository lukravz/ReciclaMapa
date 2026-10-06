import {Users,Briefcase,Building2,Check,Info,ChartNoAxesCombined,FileText} from 'lucide-react';

import {PLANS,FEATURES,type PlanId} from '@/lib/plans';
const plans=(Object.keys(PLANS) as PlanId[]).map(id=>({id,title:PLANS[id].name,icon:id==='free'?Users:id==='pro'?Briefcase:Building2,badge:id==='free'?'Gratuito':'Proposta comercial',audience:PLANS[id].audience,label:PLANS[id].price,features:Object.values(FEATURES).filter(f=>f.plan===id).map(f=>f.label+(f.ready?'':' · Em desenvolvimento')),note:id==='free'?'O acesso básico permanece gratuito.':'Contratação em breve. Inclui os recursos dos planos anteriores.'}));

export default function BusinessModel(){
 return <div className="business-model">
  <section className="business-intro" aria-labelledby="business-message">
   <h2 id="business-message">Impacto social no acesso.<br/>Sustentabilidade financeira na gestão.</h2>
   <p>O acesso básico à plataforma pode permanecer gratuito para moradores e catadores, enquanto recursos avançados de gestão podem ser oferecidos para organizações que necessitam de maior capacidade operacional.</p>
  </section>
  <aside className="business-transparency" aria-label="Transparência sobre o modelo proposto"><Info size={22} aria-hidden="true"/><p><strong>Uma proposta para o futuro.</strong> Este modelo de negócio representa uma proposta futura. O protótipo atual não realiza cobranças nem possui planos comerciais ativos.</p></aside>
  <div className="business-plans">
   {plans.map(plan=><article className={`panel business-plan business-plan-${plan.id}`} key={plan.id} aria-labelledby={`business-${plan.id}`}>
    <div className="business-plan-top"><span className="business-icon"><plan.icon size={24} aria-hidden="true"/></span><span className="business-badge">{plan.badge}</span></div>
    <h2 id={`business-${plan.id}`}>{plan.title}</h2>
    <p className="business-audience">{plan.audience}</p>
    <h3>{plan.label}</h3>
    <ul>{plan.features.map(feature=><li key={feature}><Check size={16} aria-hidden="true"/><span>{feature}</span></li>)}</ul>
    <p className="business-plan-note">{plan.note}</p>
   </article>)}
  </div>
  <section className="business-revenue" aria-labelledby="business-revenue-title">
   <h2 id="business-revenue-title">Como o ReciclaMapa pode se sustentar?</h2>
   <p>Possibilidades futuras para apoiar a continuidade da plataforma, preservando o acesso básico gratuito.</p>
   <div className="business-revenue-grid">{[
    {title:'Assinaturas',text:'Recursos avançados de gestão para cooperativas, empresas e instituições.',icon:Briefcase},
    {title:'Licenciamento institucional',text:'Uso da plataforma por organizações e administrações públicas em operações de maior escala.',icon:Building2},
    {title:'Serviços de gestão',text:'Relatórios, acompanhamento territorial e ferramentas operacionais avançadas.',icon:FileText},
   ].map(item=><article className="panel business-revenue-card" key={item.title}><item.icon size={22} aria-hidden="true"/><h3>{item.title}</h3><p>{item.text}</p></article>)}</div>
  </section>
  <p className="business-closing"><ChartNoAxesCombined size={22} aria-hidden="true"/><span>Uma possibilidade de sustentabilidade financeira na gestão, sem depender de cobrar do catador.</span></p>
 </div>;
}
