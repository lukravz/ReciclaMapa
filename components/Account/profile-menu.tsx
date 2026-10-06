'use client';
import {useEffect,useRef,useState} from 'react';
import {ChevronDown} from 'lucide-react';
import {useAccount} from './account-context';
import {PLANS} from '@/lib/plans';
import {roleLabel} from '@/lib/api-client';
export default function ProfileMenu({navigate}:{navigate:(page:string)=>void}){
 const {account,demo,demoRole,access,exit,loading}=useAccount(),[open,setOpen]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false),root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null);
 const name=demo?'Perfil demonstrativo':account?.user.name??'Minha conta',role=demo?demoRole:account?.user.role,initials=name.trim().split(/\s+/).slice(0,2).map(s=>s[0]).join('').toUpperCase();
 useEffect(()=>{if(!open)return;const outside=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node))setOpen(false);},key=(e:KeyboardEvent)=>{if(e.key==='Escape'){setOpen(false);trigger.current?.focus();}};document.addEventListener('pointerdown',outside);document.addEventListener('keydown',key);return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',key);};},[open]);
 const organization=role==='cooperative'||role==='collector';
 return <div className="profile-control" ref={root}><button ref={trigger} className="profile-trigger" aria-label={'Abrir perfil de '+name} aria-expanded={open} aria-controls="profile-menu" onClick={()=>setOpen(!open)} disabled={loading}><span className="avatar">{initials}</span><span className="profile-name"><b>{name}</b><small>{role?roleLabel[role]:''} · {PLANS[access.plan].name}</small></span><ChevronDown size={16}/></button>{open&&<section id="profile-menu" className="profile-dropdown" aria-label="Menu do perfil"><b>{name}</b><p>{role?roleLabel[role]:''} · {PLANS[access.plan].name}</p>{access.legacy&&<small>Acessos anteriores preservados</small>}{[['profile','Meu perfil'],['settings','Configurações'],...(organization?[['cooperative','Minha organização']]:[]),['plans','Planos']].map(([id,title])=><button key={id} onClick={()=>{setOpen(false);navigate(id);}}>{title}</button>)}<button disabled={busy} onClick={async()=>{setBusy(true);try{await exit();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>{busy?'Saindo…':demo?'Sair da demonstração':'Sair'}</button>{error&&<p role="alert">{error}</p>}</section>}</div>;
}
