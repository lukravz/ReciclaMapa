import type { Coordinates } from '@/types';
export function locateUser(): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('Seu navegador não oferece localização. Informe as coordenadas ou clique no mapa.')); return; }
    navigator.geolocation.getCurrentPosition(p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }), e => reject(new Error(e.code === 1 ? 'Permissão de localização negada. Você pode informar o endereço ou clicar no mapa.' : e.code === 3 ? 'A localização demorou para responder. Tente novamente ou preencha manualmente.' : 'Localização indisponível. Você pode continuar pelo endereço ou mapa.')), { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
  });
}
