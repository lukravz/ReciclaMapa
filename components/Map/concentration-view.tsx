'use client';
import {useState} from 'react';
import {Map,Layers} from 'lucide-react';
import type {Point} from '@/types';
import TerritoryMap from '../territory-map';
export default function ConcentrationView({points}:{points:Point[]}){const [show,setShow]=useState(false);return <section className="panel concentration-map-section"><div className="panel-heading"><div><h2>Concentração geográfica</h2><p>Círculos com área proporcional aos kg em cada ponto.</p></div><button className="btn light" onClick={()=>setShow(!show)}>{show?<Layers size={16}/>:<Map size={16}/>} {show?'Recolher mapa':'Ver mapa de concentração'}</button></div>{show&&<><div className="large-map"><TerritoryMap points={points} concentration/></div><p className="map-footnote">Quanto mais material, maior o círculo. As cores identificam o material. Localizações residenciais são aproximadas. O ranking por região permanece abaixo.</p></>}</section>;}
