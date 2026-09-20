export type HistoryRecord={date:string;kg:number};
export function summarizeHistory(input:HistoryRecord[],frequency:string,now=new Date()){
 const records=input.filter(r=>Number.isFinite(r.kg)&&r.kg>0&&Number.isFinite(Date.parse(r.date))).sort((a,b)=>a.date.localeCompare(b.date));
 const values=records.map(r=>r.kg),samples=records.length,window=records.slice(-5);
 // Oldest to newest: weights 1..n within the last five records. No prediction below 3 samples.
 const weighted=samples>=3?window.reduce((s,r,i)=>s+r.kg*(i+1),0)/(window.length*(window.length+1)/2):null;
 const period=({Semanal:7,Quinzenal:14,Mensal:30} as Record<string,number>)[frequency];
 let next:string|null=null;
 if(weighted!==null&&period){const date=new Date(records.at(-1)!.date);date.setUTCDate(date.getUTCDate()+period);if(date<now)date.setUTCDate(date.getUTCDate()+Math.ceil((now.getTime()-date.getTime())/(period*864e5))*period);next=date.toISOString();}
 return {samples,average:samples?values.reduce((s,v)=>s+v,0)/samples:0,min:samples?Math.min(...values):0,max:samples?Math.max(...values):0,trend:samples>=2?values.at(-1)!-values.at(-2)!:null,weighted:period?weighted:null,next,period:period??null,window:window.length};
}
