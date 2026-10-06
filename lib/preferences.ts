export type Theme='light'|'dark'|'system';
export const NOTIFICATION_CATEGORIES={scheduling:'Reservas e agendamentos',changes:'Alterações ou cancelamentos',confirmation:'Confirmação de disponibilidade',results:'Resultados das coletas'} as const;
export type Preferences={theme:Theme;reduceMotion:boolean;notifications:Record<keyof typeof NOTIFICATION_CATEGORIES,boolean>;revision:number};
export const defaultPreferences:Preferences={theme:'system',reduceMotion:false,notifications:{scheduling:true,changes:true,confirmation:true,results:true},revision:0};
export function notificationCategory(type:string):keyof typeof NOTIFICATION_CATEGORIES|null{
 if(type==='material.changed'||type==='waste.available'||type.includes('cancel')||type.includes('release'))return 'changes';
 if(type.includes('confirm')||type.includes('expir'))return 'confirmation';
 if(type.includes('result')||type.includes('collect'))return 'results';
 if(type==='route.started'||type.includes('reserv')||type.includes('schedul'))return 'scheduling';
 return null;
}
export function notificationVisible(type:string,prefs:Preferences){const category=notificationCategory(type);return category===null||prefs.notifications[category];}
