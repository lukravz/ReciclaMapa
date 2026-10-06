'use client';
import {useState} from 'react';
import {WEEKDAYS,type PickupWindow} from '@/lib/collection-reliability';
export default function AvailabilityFields({initial=[]}:{initial?:PickupWindow[]}){
 const [windows,setWindows]=useState(initial);
 function update(day:number,field:'start'|'end',value:string){setWindows(ws=>ws.map(w=>w.day===day?{...w,[field]:value}:w));}
 return <fieldset className="pickup-fields"><legend>Dias e horários para retirada</legend><p>Sem dias selecionados: Horário a combinar. Use uma faixa por dia.</p><input type="hidden" name="pickupWindows" value={JSON.stringify(windows)}/>{WEEKDAYS.map((name,day)=>{const w=windows.find(w=>w.day===day);return <div className="pickup-day" key={day}><label className="check-row"><input type="checkbox" checked={!!w} onChange={e=>setWindows(ws=>e.target.checked?[...ws,{day,start:'08:00',end:'18:00'}]:ws.filter(w=>w.day!==day))}/>{name}</label>{w&&<><label>De<input type="time" required value={w.start} onChange={e=>update(day,'start',e.target.value)}/></label><label>Até<input type="time" required value={w.end} min={w.start} onChange={e=>update(day,'end',e.target.value)}/></label></>}</div>;})}</fieldset>;
}
