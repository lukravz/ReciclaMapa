'use client';
import {useEffect,useState} from 'react';
import {Bell} from 'lucide-react';
import {api} from '@/lib/api-client';
type Notice={id:string;title:string;message:string;readAt:string|null;createdAt:string};
export default function Notifications(){
 const [open,setOpen]=useState(false),[items,setItems]=useState<Notice[]>([]),[unread,setUnread]=useState(0),[error,setError]=useState('');
 async function refresh(){try{const r=await api<{items:Notice[];unread:number}>('notifications');setItems(r.items);setUnread(r.unread);setError('');}catch(e){setError((e as Error).message);}}
 useEffect(()=>{refresh();const timer=setInterval(refresh,30000);return()=>clearInterval(timer);},[]);
 async function read(id?:string){try{await api('notifications/'+(id?id+'/read':'read-all'),'POST',{});await refresh();}catch(e){setError((e as Error).message);}}
 return <div className="notification-center"><button className="btn light" aria-label={`Notificações: ${unread} não lidas`} aria-expanded={open} onClick={()=>{setOpen(!open);refresh();}}><Bell size={18}/>{unread>0&&<b>{unread}</b>}</button>{open&&<section className="notification-panel" aria-label="Notificações"><div><h3>Notificações</h3><button className="text-btn" onClick={()=>setOpen(false)}>Fechar</button></div><button className="text-btn" onClick={()=>read()}>Marcar todas como lidas</button>{error&&<p role="alert">{error}</p>}{!items.length&&<p>Nenhuma notificação.</p>}{items.map(n=><article key={n.id}><b>{!n.readAt?'● ':''}{n.title}</b><p>{n.message}</p><small>{new Date(n.createdAt).toLocaleString('pt-BR')}</small>{!n.readAt&&<button className="text-btn" onClick={()=>read(n.id)}>Marcar como lida</button>}</article>)}</section>}</div>;
}
