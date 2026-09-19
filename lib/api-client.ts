export async function api<T=unknown>(path:string,method='GET',body?:unknown,signal?:AbortSignal):Promise<T>{
 const response=await fetch('/api/'+path,{method,headers:method==='GET'?undefined:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),credentials:'same-origin',cache:'no-store',signal});
 const data=await response.json();if(!response.ok)throw new Error(data.error??'Não foi possível carregar os dados.');return data;
}
export function wastePayload(p:import('@/types').Point){return {name:p.name,type:p.type,material:p.material,kg:p.kg,lat:p.lat,lng:p.lng,address:p.address,street:p.street??'',number:p.number??'',postcode:p.postcode??'',region:p.region,city:p.city??'',state:p.state??'',availability:p.availability,frequency:p.frequency,locationConfirmed:true};}
export type SessionUser={id:string;name:string;email:string;role:'generator'|'collector'|'cooperative'|'admin'};
export const roleLabel={generator:'Gerador',collector:'Coletor',cooperative:'Cooperativa',admin:'Administrador'};
export const statusLabel={available:'Disponível',reserved:'Reservado',scheduled:'Coleta agendada',collected:'Coletado',cancelled:'Cancelado',draft:'Rascunho',in_progress:'Em andamento',completed:'Concluída'};
