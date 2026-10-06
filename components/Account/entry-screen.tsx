'use client';
import {Recycle,ArrowRight,Play,MapPin,Route,Leaf} from 'lucide-react';
import type {SessionUser} from '@/lib/api-client';
import VisitorAppearance from './visitor-appearance';
import AuthPanel from './auth-panel';

export default function EntryScreen({onLogin,onDemo,error}:{onLogin:(user:SessionUser)=>void;onDemo:(profile?:'generator'|'collector'|'cooperative')=>void;error?:string}){
 return <main className="entry-screen">
  <section className="entry-story" aria-labelledby="entry-title">
   <div className="entry-brand"><Recycle size={30} aria-hidden="true"/><span>RECICLA<strong>MAPA</strong></span></div>
   <div className="entry-story-body"><span className="entry-eyebrow">CADA COLETA COMEÇA COM UMA CONEXÃO</span><h1 id="entry-title">Resíduos em dados.<br/>Dados em rotas.</h1><p>Conecte materiais recicláveis a quem pode coletar. Organize cada etapa e acompanhe o resultado.</p><ul><li><MapPin aria-hidden="true"/>Encontre materiais no território</li><li><Route aria-hidden="true"/>Organize rotas e coletas</li><li><Leaf aria-hidden="true"/>Acompanhe o impacto de cada coleta</li></ul></div>
   <small>Uma plataforma para geradores, catadores e cooperativas.</small>
  </section>
  <section className="entry-access" aria-label="Acesse sua conta">
   <div className="entry-access-inner"><div className="entry-utilities"><a href="#entry-login">Entrar / Criar conta</a><VisitorAppearance/></div><div id="entry-login"/>{error&&<p className="error-banner" role="alert">{error} Você pode tentar entrar novamente ou conhecer a demonstração.</p>}<AuthPanel onLogin={onLogin} compact/>
    <div className="entry-demo"><p>Quer conhecer antes de criar sua conta?</p><button className="btn light" onClick={()=>onDemo()}><Play size={17} aria-hidden="true"/>Explorar demonstração<ArrowRight size={17} aria-hidden="true"/></button><div className="demo-logins" role="group" aria-label="Perfis de teste demonstrativos"><button className="btn" onClick={()=>onDemo('generator')}>Gerador demo</button><button className="btn" onClick={()=>onDemo('collector')}>Coletor demo</button><button className="btn" onClick={()=>onDemo('cooperative')}>Cooperativa demo</button></div><small>Perfis de teste isolados, sem senha. Não representam contas reais.</small><small>Sem cadastro · Dados fictícios · Nenhuma alteração em contas reais</small></div>
   </div>
  </section>
 </main>;
}
