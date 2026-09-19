import type { Metadata } from 'next';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import './globals.css';
export const metadata: Metadata = { title: 'RECICLAMAPA — Resíduos em dados. Dados em rotas.', description: 'Inteligência territorial e logística para coleta seletiva. Protótipo funcional com armazenamento local.', icons: { icon: '/favicon.svg' } };
export default function RootLayout({children}: Readonly<{children:React.ReactNode}>) { return <html lang="pt-BR"><body>{children}</body></html>; }

