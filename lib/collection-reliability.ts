export interface PickupWindow {day:number;start:string;end:string}
export const WEEKDAYS=['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
export const OUTCOMES={collected:'Coleta realizada',partial:'Coleta parcial',closed:'Local fechado ou responsável ausente',unavailable:'Material indisponível',unsuitable:'Material inadequado para coleta',other:'Outro motivo'};
export type Outcome=keyof typeof OUTCOMES;
export function parseWindow(value:string){
 const match=value.trim().match(/^(\d{1,2})(?::(\d{2}))?h?\s*[-–]\s*(\d{1,2})(?::(\d{2}))?h?$/);
 if(!match)return null;
 const start=Number(match[1])*60+Number(match[2]??0),end=Number(match[3])*60+Number(match[4]??0);
 return Number(match[1])<24&&Number(match[3])<24&&Number(match[2]??0)<60&&Number(match[4]??0)<60&&start<end?{start,end}:null;
}
export function compatibleWindow(windows:PickupWindow[]|undefined,date:string,window:string){
 if(!windows?.length)return true;
 const chosen=parseWindow(window);if(!chosen)return false;
 const day=new Date(date+'T12:00:00Z').getUTCDay();
 return windows.some(w=>{const hours=parseWindow(`${w.start}-${w.end}`);return w.day===day&&hours&&chosen.start>=hours.start&&chosen.end<=hours.end;});
}
export function availabilityText(windows:PickupWindow[]|undefined){return windows?.length?windows.map(w=>`${WEEKDAYS[w.day]} ${w.start}–${w.end}`).join(' · '):'Horário a combinar';}
export function needsConfirmation(point:{expiresAt?:string|null;confirmedAt?:string|null},at=Date.now()){return !!point.expiresAt&&(!point.confirmedAt||Date.parse(point.expiresAt)<=at);}
export function defaultValidity(value:unknown){const n=Number(value);return Number.isInteger(n)&&n>=1&&n<=90?n:7;}
export function expiry(at:string,days:number){return new Date(Date.parse(at)+days*86400000).toISOString();}
export function outcomeStock(outcome:Outcome,actualWeight:number,remainingAvailable:boolean,remainingKg:number|undefined){
 if(outcome==='collected'||outcome==='partial'){
  if(!Number.isFinite(actualWeight)||actualWeight<=0||actualWeight>1000000)throw new Error('Informe o peso realmente coletado.');
  if(outcome==='partial'&&remainingAvailable&&(!Number.isFinite(remainingKg)||remainingKg!<=0||remainingKg!>1000000))throw new Error('Informe a quantidade estimada restante.');
  if(outcome==='partial'&&!remainingAvailable&&remainingKg)throw new Error('Sem material restante, informe saldo zero.');
  if(outcome==='collected'&&(remainingAvailable||remainingKg))throw new Error('Use coleta parcial para registrar material restante.');
  return {actualWeight,remainingKg:outcome==='partial'&&remainingAvailable?remainingKg!:0};
 }
 if(actualWeight!==0||remainingAvailable||remainingKg)throw new Error('Ocorrências sem retirada devem registrar zero coletado.');
 return {actualWeight:0,remainingKg:0};
}
