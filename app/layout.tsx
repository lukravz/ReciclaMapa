import type { Metadata } from 'next';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import './globals.css';
import './themes.css';
export const metadata: Metadata = { title: 'RECICLAMAPA — Resíduos em dados. Dados em rotas.', description: 'Inteligência territorial e logística para coleta seletiva. Protótipo funcional com armazenamento local.', icons: { icon: '/favicon.svg' } };
export default function RootLayout({children}: Readonly<{children:React.ReactNode}>) { return <html lang="pt-BR" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html:`try{var p=JSON.parse(localStorage.getItem("reciclamapa-appearance")||"{}");document.documentElement.dataset.theme=p.theme==="dark"||p.theme==="system"&&matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.dataset.motion=p.reduceMotion?"reduce":"full";}catch(e){document.documentElement.dataset.theme="light";}`}}/></head><body>{children}</body></html>; }

