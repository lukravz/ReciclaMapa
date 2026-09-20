import {Users,Briefcase,Building2,Check,Info,ChartNoAxesCombined,FileText} from 'lucide-react';

const plans=[
 {id:'free',title:'Acesso gratuito',icon:Users,badge:'Gratuito',audience:'Moradores, pequenos geradores e catadores independentes.',label:'Acesso básico',features:['Cadastro de resíduos','Mapa','Visualização de materiais','Reserva/coleta básica','Acompanhamento de status'],note:'O objetivo é não criar barreiras de acesso para quem gera ou coleta materiais recicláveis.'},
 {id:'professional',title:'Plano profissional',icon:Briefcase,badge:'Proposta futura',audience:'Cooperativas, associações e organizações de coleta.',label:'Possíveis recursos futuros',features:['Gestão de múltiplas rotas','Histórico ampliado','Relatórios operacionais','Gestão de vários usuários','Indicadores de produtividade','Planejamento recorrente','Exportação de dados'],note:'Modelo proposto para futuras versões comerciais.'},
 {id:'institutional',title:'Plano institucional',icon:Building2,badge:'Proposta futura',audience:'Empresas, prefeituras, organizações, projetos públicos e grandes geradores.',label:'Possíveis recursos futuros',features:['Indicadores territoriais','Acompanhamento de regiões','Relatórios gerenciais','Histórico consolidado','Gestão de múltiplas unidades','Análise de geração de resíduos','Exportação de relatórios','Visão institucional'],note:'Possibilidade de gestão em maior escala, a ser validada com as instituições.'},
];

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
