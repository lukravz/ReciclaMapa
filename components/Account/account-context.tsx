'use client';
import {createContext,useContext,useEffect,useState,useCallback} from 'react';
import {api,type SessionUser} from '@/lib/api-client';
import {accessFor,type Access,type PlanId} from '@/lib/plans';
import {defaultPreferences,type Preferences} from '@/lib/preferences';
export type Account={user:SessionUser;profile:{phone:string|null;city:string;state:string;profileType:string}|null;version:string;preferences:Preferences;access:Access};
type Context={account:Account|null;access:Access;demo:boolean;demoPlan:PlanId;setDemoPlan:(p:PlanId)=>void;loading:boolean;error:string;refresh:()=>Promise<void>;update:(a:Account)=>void;preferences:Preferences;save:(p:Preferences)=>Promise<void>;exit:()=>Promise<void>;demoRole:SessionUser['role']};
const AccountContext=createContext<Context|null>(null);
export function applyAppearance(p:Preferences){const root=document.documentElement;root.dataset.theme=p.theme==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):p.theme;root.dataset.motion=p.reduceMotion?'reduce':'full';}
export function AccountProvider({children,demo,demoRole,onExit}:{children:React.ReactNode;demo:boolean;demoRole:SessionUser['role'];onExit:()=>void}){
 const [account,setAccount]=useState<Account|null>(null),[demoPlan,setDemoPlan]=useState<PlanId>('free'),[preferences,setPreferences]=useState<Preferences>(defaultPreferences),[loading,setLoading]=useState(!demo),[error,setError]=useState('');
 const key=demo?'reciclamapa-demo-preferences':'reciclamapa-appearance';
 function appearance(p:Preferences){setPreferences(p);applyAppearance(p);try{localStorage.setItem(key,JSON.stringify(p));localStorage.setItem('reciclamapa-appearance',JSON.stringify(p));}catch{}}
 const refresh=useCallback(async()=>{if(demo)return;try{const a=await api<Account>('account');setAccount(a);setError('');appearance(a.preferences);}catch(e){setError((e as Error).message);throw e;}finally{setLoading(false);}},[demo]);
 useEffect(()=>{if(demo){try{const value=localStorage.getItem(key);appearance({...defaultPreferences,...(value?JSON.parse(value):{})});}catch{}}else refresh().catch(()=>{});},[demo,refresh]);
 useEffect(()=>{const media=matchMedia('(prefers-color-scheme: dark)'),change=()=>applyAppearance(preferences);media.addEventListener('change',change);return()=>media.removeEventListener('change',change);},[preferences]);
 async function save(p:Preferences){if(demo){appearance(p);return;}const saved=await api<Preferences>('account/preferences','PATCH',p);appearance(saved);setAccount(a=>a?{...a,preferences:saved}:a);}
 async function exit(){if(!demo)await api('auth/logout','POST',{});setAccount(null);onExit();}
 return <AccountContext.Provider value={{account,access:demo?accessFor(demoPlan):account?.access??accessFor(),demo,demoRole,demoPlan,setDemoPlan,loading,error,refresh,update:a=>{setAccount(a);appearance(a.preferences);},preferences,save,exit}}>{children}</AccountContext.Provider>;
}
export function useAccount(){const context=useContext(AccountContext);if(!context)throw new Error('AccountProvider required');return context;}
