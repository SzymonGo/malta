// Walidacja danych: placeRef istnieją, id unikalne, godziny nie maleją w obrębie dnia.

import { toMin } from './util.js';

const TYPES = ['see', 'eat', 'transport', 'task', 'buy', 'view', 'free'];
const MODES = ['ferry', 'bus', 'walk', 'bolt', 'lift', 'plane', 'boat'];

export function validateData(data) {
  const errors = [];
  const places = data.places || {};
  const ref = (where, id) => {
    if (id && !places[id]) errors.push(`${where}: brak miejsca „${id}”`);
  };

  ref('hotel', data.hotel?.placeRef);
  ref('hypogeum', data.hypogeum?.placeRef);
  ref('hypogeum.attemptThursday', data.hypogeum?.attemptThursday?.placeRef);

  for (const [pid, p] of Object.entries(places)) {
    for (const f of p.food || []) ref(`places.${pid}.food`, f);
    if (p.lat != null && (typeof p.lat !== 'number' || typeof p.lng !== 'number')) errors.push(`places.${pid}: złe współrzędne`);
    for (const img of p.images || []) {
      if (!img.file || !img.author || !img.license) errors.push(`places.${pid}: niepełna atrybucja zdjęcia`);
    }
  }

  const allTids = new Set(Object.keys(data.templates || {}));
  for (const tid of Object.values(data.schedule.fixed)) if (!allTids.has(tid)) errors.push(`schedule.fixed: brak szablonu ${tid}`);
  for (const tid of Object.values(data.schedule.flexDefault)) if (!allTids.has(tid)) errors.push(`schedule.flexDefault: brak szablonu ${tid}`);
  for (const need of ['SOUTH_H12', 'SOUTH_H16', 'VALLETTA_H12', 'VALLETTA_H16', 'SOUTH_NONE', 'VALLETTA']) {
    if (!allTids.has(need)) errors.push(`brak szablonu ${need}`);
  }

  for (const [tid, t] of Object.entries(data.templates || {})) {
    const ids = new Set();
    let last = -1;
    let lastLabel = '';
    const check = (it, where) => {
      if (!it.id) errors.push(`${tid}: punkt bez id (${where})`);
      else if (ids.has(it.id)) errors.push(`${tid}: zduplikowane id ${it.id}`);
      ids.add(it.id);
      if (!TYPES.includes(it.type)) errors.push(`${tid}.${it.id}: nieznany typ ${it.type}`);
      if (!/^\d{2}:\d{2}$/.test(it.time || '')) errors.push(`${tid}.${it.id}: zła godzina ${it.time}`);
      ref(`${tid}.${it.id}`, it.placeRef);
      for (const f of it.food || []) ref(`${tid}.${it.id}.food`, f);
      for (const f of it.alsoRefs || []) ref(`${tid}.${it.id}.alsoRefs`, f);
      if (it.getThere && it.getThere.mode && !MODES.includes(it.getThere.mode)) {
        errors.push(`${tid}.${it.id}: nieznany środek transportu ${it.getThere.mode}`);
      }
      const m = toMin(it.time);
      // Punkty warunkowe (attempt/noAttempt) mogą się wykluczać – porównujemy tylko bezwarunkowe sąsiedztwo.
      if (m < last) errors.push(`${tid}.${it.id}: godzina ${it.time} wcześniejsza niż ${lastLabel}`);
      if (!it.task?.showWhen) {
        last = m;
        lastLabel = `${it.id} (${it.time})`;
      }
    };
    for (const b of t.blocks || []) {
      if (!b.location) errors.push(`${tid}: blok bez nazwy lokalizacji`);
      if (b.transfer) check(b.transfer, b.location);
      for (const it of b.items || []) check(it, b.location);
    }
  }

  for (const b of data.bookings || []) {
    ref(`bookings.${b.id}`, b.placeRef);
    for (const tid of [].concat(b.templateRef || [])) if (!allTids.has(tid)) errors.push(`bookings.${b.id}: brak szablonu ${tid}`);
  }
  return errors;
}

// Walidacja wyliczonego dnia (po scenariuszach i przesunięciach).
export function validateDay(day) {
  const errors = [];
  let last = -1;
  for (const it of day.flat) {
    const m = toMin(it.time);
    if (m < last) errors.push(`${day.date} ${day.tid}: ${it.key} (${it.time}) wcześniej niż poprzedni punkt`);
    last = m;
  }
  return errors;
}
