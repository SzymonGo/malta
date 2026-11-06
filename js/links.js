// Linki do Google Maps, WhatsApp, telefonu i Bolta.

function searchText(p) {
  return encodeURIComponent(p.q || `${p.name} ${p.area || ''} Malta`).replace(/%20/g, '+');
}

export function mapsPin(p) {
  if (typeof p.lat === 'number' && typeof p.lng === 'number') {
    return `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}` + (p.placeId ? `&query_place_id=${p.placeId}` : '');
  }
  return `https://www.google.com/maps/search/?api=1&query=${searchText(p)}`;
}

export function mapsRoute(p, mode = 'transit') {
  const tm = mode === 'walking' ? 'walking' : 'transit';
  if (typeof p.lat === 'number' && typeof p.lng === 'number') {
    return (
      `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}` +
      (p.placeId ? `&destination_place_id=${p.placeId}` : '') +
      `&travelmode=${tm}`
    );
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${searchText(p)}&travelmode=${tm}`;
}

export function whatsapp(num) {
  return `https://wa.me/${String(num).replace(/\D/g, '')}`;
}

export function tel(num) {
  return `tel:${String(num).replace(/[^\d+]/g, '')}`;
}

export const BOLT_APP = 'bolt://';
export const BOLT_WEB = 'https://bolt.eu';

// Próba otwarcia aplikacji Bolt, a jeśli strona nadal widoczna – bolt.eu.
export function openBolt() {
  let left = false;
  const onHide = () => {
    if (document.visibilityState === 'hidden') left = true;
  };
  document.addEventListener('visibilitychange', onHide);
  try {
    window.location.href = BOLT_APP;
  } catch {
    /* brak aplikacji */
  }
  setTimeout(() => {
    document.removeEventListener('visibilitychange', onHide);
    if (!left && document.visibilityState === 'visible') window.open(BOLT_WEB, '_blank', 'noopener');
  }, 1500);
}
