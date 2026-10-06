export const PLANS = {
 free: {name:'Gratuito',price:'Gratuito',audience:'Moradores, pequenos geradores e catadores independentes'},
 pro: {name:'Pro',price:'Preço a definir',audience:'Cooperativas, associações e organizações de coleta'},
 institutional: {name:'Institucional',price:'Sob consulta',audience:'Empresas, grandes geradores e instituições'},
} as const;
export type PlanId=keyof typeof PLANS;
export const FEATURES={
 materials:{label:'Cadastro e atualização de materiais',plan:'free',ready:true,legacy:true},
 map:{label:'Mapa e filtros básicos',plan:'free',ready:true,legacy:true},
 availability:{label:'Disponibilidade e horários de retirada',plan:'free',ready:true,legacy:true},
 scheduling:{label:'Reservas e agendamentos',plan:'free',ready:true,legacy:true},
 route:{label:'Uma rota por vez',plan:'free',ready:true,legacy:true},
 results:{label:'Resultados e ocorrências por parada',plan:'free',ready:true,legacy:true},
 history:{label:'Histórico pessoal e indicadores básicos',plan:'free',ready:true,legacy:true},
 notifications:{label:'Notificações operacionais',plan:'free',ready:true,legacy:true},
 parallelRoutes:{label:'Múltiplas rotas em paralelo',plan:'pro',ready:true,legacy:true},
 team:{label:'Equipe com permissões',plan:'pro',ready:false,legacy:false},
 territory:{label:'Concentração e oportunidades por região',plan:'pro',ready:true,legacy:true},
 forecasts:{label:'Previsões com base no histórico',plan:'pro',ready:true,legacy:true},
 productivity:{label:'Produtividade da organização',plan:'pro',ready:true,legacy:true},
 exports:{label:'Relatórios e exportação da organização',plan:'pro',ready:true,legacy:false},
 units:{label:'Gestão de múltiplas unidades',plan:'institutional',ready:false,legacy:false},
 consolidated:{label:'Visão consolidada e comparação entre unidades',plan:'institutional',ready:false,legacy:false},
 advancedReports:{label:'Relatórios por período, material e região',plan:'institutional',ready:false,legacy:false},
 unitPermissions:{label:'Usuários e permissões por unidade',plan:'institutional',ready:false,legacy:false},
 consolidatedIndicators:{label:'Indicadores consolidados de operação',plan:'institutional',ready:false,legacy:false},
} as const;
export type Feature=keyof typeof FEATURES;
export type Access={plan:PlanId;legacy:boolean;scope:'account'|'organization';organizationId:string|null;features:Record<Feature,boolean>};
export function featureAllowed(plan:PlanId,legacy:boolean,feature:Feature){
 const f=FEATURES[feature],rank={free:0,pro:1,institutional:2};
 return f.ready&&(rank[plan]>=rank[f.plan]||legacy&&f.legacy);
}
export function accessFor(plan:PlanId='free',legacy=false,organizationId:string|null=null):Access{
 return {plan,legacy,organizationId,scope:organizationId?'organization':'account',features:Object.fromEntries(Object.keys(FEATURES).map(f=>[f,featureAllowed(plan,legacy,f as Feature)])) as Access['features']};
}
