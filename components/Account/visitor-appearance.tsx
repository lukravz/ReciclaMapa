'use client';
import {useEffect,useState} from 'react';
import {defaultPreferences,type Preferences} from '@/lib/preferences';
import {applyAppearance} from './account-context';
export default function VisitorAppearance(){
 const [preferences,setPreferences]=useState<Preferences>(defaultPreferences),[loaded,setLoaded]=useState(false);
 useEffect(()=>{try{const saved=localStorage.getItem('reciclamapa-appearance');if(saved)setPreferences({...defaultPreferences,...JSON.parse(saved)});}catch{}setLoaded(true);},[]);
 useEffect(()=>{if(!loaded)return;applyAppearance(preferences);const media=matchMedia('(prefers-color-scheme: dark)'),change=()=>applyAppearance(preferences);media.addEventListener('change',change);return()=>media.removeEventListener('change',change);},[preferences,loaded]);
 function update(p:Preferences){setPreferences(p);try{localStorage.setItem('reciclamapa-appearance',JSON.stringify(p));}catch{}}
 return <details className="visitor-appearance"><summary>Aparência</summary><div><label>Tema<select value={preferences.theme} onChange={e=>update({...preferences,theme:e.target.value as Preferences['theme']})}><option value="light">Claro</option><option value="dark">Escuro</option><option value="system">Sistema</option></select></label><label className="settings-check"><input type="checkbox" checked={preferences.reduceMotion} onChange={e=>update({...preferences,reduceMotion:e.target.checked})}/>Reduzir animações</label></div></details>;
}
