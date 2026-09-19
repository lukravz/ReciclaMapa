'use client';
import { useEffect, useRef, useState } from 'react';
import { Search, LoaderCircle, MapPin, ShieldCheck } from 'lucide-react';
import type { Coordinates, GeocodingResult } from '@/types';
import { geocodeAddress, reverseGeocode } from '@/lib/geocoding';
import { isCoordinate } from '@/lib/geo';
import TerritoryMap from '../territory-map';
export interface AddressDraft { street:string; number:string; region:string; city:string; state:string; postcode:string }
export const blankAddress:AddressDraft={street:'',number:'',region:'',city:'',state:'',postcode:''};
export default function LocationEditor({address,onAddress,position,onPosition,confirmed,onConfirmed,residential=false,requireAddress=true}:{requireAddress?:boolean;address:AddressDraft;onAddress:(value:AddressDraft)=>void;position:Coordinates|null;onPosition:(value:Coordinates|null)=>void;confirmed:boolean;onConfirmed:(value:boolean)=>void;residential?:boolean}) {
  const [latText,setLatText]=useState(position?String(position.lat):''),[lngText,setLngText]=useState(position?String(position.lng):'');
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[results,setResults]=useState<GeocodingResult[]>([]);
  const abort=useRef<AbortController|null>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null),sequence=useRef(0);
  useEffect(()=>()=>{abort.current?.abort();if(timer.current)clearTimeout(timer.current);},[]);
  function cancel(){sequence.current++;abort.current?.abort();if(timer.current)clearTimeout(timer.current);setBusy(false);setResults([]);}
  function editAddress(key:keyof AddressDraft,value:string){cancel();onAddress({...address,[key]:value});onConfirmed(false);}
  function setPosition(p:Coordinates|null){onPosition(p);setLatText(p?String(Number(p.lat.toFixed(6))):'');setLngText(p?String(Number(p.lng.toFixed(6))):'');onConfirmed(false);}
  function mergeAddress(result:GeocodingResult){const next={...address};for(const key of ['street','number','region','city','state','postcode'] as const)if(result[key])next[key]=result[key]!;onAddress(next);}
  function select(result:GeocodingResult){cancel();setPosition(result);mergeAddress(result);setError('');}
  function search(){cancel();setError('');setBusy(true);const id=sequence.current;timer.current=setTimeout(async()=>{const controller=new AbortController();abort.current=controller;try{const list=await geocodeAddress({...address,residential},controller.signal);if(id!==sequence.current)return;setResults(list);if(!list.length)setError('Endereço não encontrado. Confira os campos ou escolha uma posição no mapa.');}catch(e){if(id===sequence.current&&!controller.signal.aborted)setError((e as Error).message);}finally{if(id===sequence.current)setBusy(false);}},700);}
  function pick(p:Coordinates){cancel();setPosition(p);setError('');setBusy(true);const id=sequence.current;timer.current=setTimeout(async()=>{const controller=new AbortController();abort.current=controller;try{const result=await reverseGeocode(p,residential,controller.signal);if(id===sequence.current)mergeAddress(result);}catch(e){if(id===sequence.current&&!controller.signal.aborted)setError((e as Error).message+' As coordenadas selecionadas foram mantidas.');}finally{if(id===sequence.current)setBusy(false);}},700);}
  function manual(axis:'lat'|'lng',value:string){cancel();onConfirmed(false);const lat=axis==='lat'?value:latText,lng=axis==='lng'?value:lngText;if(axis==='lat')setLatText(value);else setLngText(value);const p={lat:Number(lat),lng:Number(lng)};onPosition(lat.trim()&&lng.trim()&&isCoordinate(p)?p:null);}
  return <div className="location-editor"><div className="form-grid">
    <label className="wide">Endereço / rua<input value={address.street} onChange={e=>editAddress('street',e.target.value)} maxLength={180} required={requireAddress} placeholder="Ex.: Rua Major Facundo"/></label>
    <label>Número<input value={address.number} onChange={e=>editAddress('number',e.target.value)} maxLength={30} placeholder="Número ou s/n" required={requireAddress}/></label>
    <label>Bairro / região<input value={address.region} onChange={e=>editAddress('region',e.target.value)} required={requireAddress} maxLength={100} placeholder="Ex.: Centro"/></label>
    <label>Cidade<input value={address.city} onChange={e=>editAddress('city',e.target.value)} required={requireAddress} maxLength={100} placeholder="Ex.: Fortaleza"/></label>
    <label>Estado<input value={address.state} onChange={e=>editAddress('state',e.target.value)} required={requireAddress} maxLength={50} placeholder="Ex.: CE"/></label>
    <label>CEP (opcional)<input value={address.postcode} onChange={e=>editAddress('postcode',e.target.value)} maxLength={12} placeholder="00000-000"/></label>
    <div className="address-search"><button type="button" className="btn light" onClick={search} disabled={busy||!address.city.trim()||!address.state.trim()||(!address.street.trim()&&!address.region.trim())}>{busy?<LoaderCircle className="spinning" size={17}/>:<Search size={17}/>} {busy?'Buscando endereço...':'Buscar endereço no mapa'}</button></div>
  </div><p className="provider-note">{residential?'Para residências, apenas bairro, cidade e estado são consultados. A posição exata pode ser ajustada manualmente no formulário.':'A busca envia este endereço ao Nominatim/OpenStreetMap. Não inclua nomes de pessoas ou informações confidenciais.'} Busca somente por solicitação. <a href="https://operations.osmfoundation.org/policies/nominatim/" target="_blank" rel="noreferrer">Política de uso</a> · © OpenStreetMap contributors</p>
  {results.length>0&&<div className="address-results" role="group" aria-label="Endereços encontrados">{results.map((result,i)=><button key={i} type="button" onClick={()=>select(result)}><MapPin size={17}/><span>{result.label}</span></button>)}</div>}
  {error&&<div className="notice" role="status">{error}</div>}
  <p className="location-instruction"><MapPin size={16}/> Clique no mapa para escolher ou ajustar a localização.</p>
  <div className="location-picker"><TerritoryMap points={[]} picked={position} focus={position} onPick={pick} privatePicker={residential}/></div>
  <div className="form-grid coordinate-inputs"><label>Latitude<input type="number" step="any" min="-90" max="90" value={latText} onChange={e=>manual('lat',e.target.value)} required={requireAddress} placeholder="-3.732700"/></label><label>Longitude<input type="number" step="any" min="-180" max="180" value={lngText} onChange={e=>manual('lng',e.target.value)} required={requireAddress} placeholder="-38.526700"/></label></div>
  <label className="check-row confirm-location"><input type="checkbox" checked={confirmed} disabled={!position||busy} required onChange={e=>onConfirmed(e.target.checked)}/><span>Confirmar localização <small>Confira o endereço e o marcador antes de salvar.</small></span><ShieldCheck size={20}/></label>
  {residential&&<p className="provider-note">Localizações residenciais podem ser exibidas de forma aproximada para proteger a privacidade. O endereço completo não aparece nos mapas de operação.</p>}
  </div>;
}

