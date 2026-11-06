// Logika planu: rozkład szablonów na daty (scenariusz Hypogeum + zamiany),
// a potem złożenie konkretnego dnia (warunki showWhen, próby last-minute, przesunięcia).

import { addDays, dayDiff, toMin, fromMin, weekday } from './util.js';

export function tripDates(data) {
  const out = [];
  let d = data.meta.start;
  while (d <= data.meta.end) {
    out.push(d);
    d = addDays(d, 1);
  }
  return out;
}

export function flexDates(data) {
  return Object.keys(data.schedule.flexDefault).sort();
}

export function defaultTemplate(data, date) {
  return data.schedule.fixed[date] || data.schedule.flexDefault[date];
}

// Która tura (12/16) obowiązuje dla ustawień — przy „innej godzinie” bliższy wariant.
export function slotOf(h) {
  if (h.slot === 'custom') {
    if (!h.customTime) return '12';
    return Math.abs(toMin(h.customTime) - 12 * 60) <= Math.abs(toMin(h.customTime) - 16 * 60) ? '12' : '16';
  }
  return h.slot === '16' ? '16' : '12';
}

export function ticketDateOf(data, settings) {
  const h = settings.hypogeum;
  return h.mode === 'ticket' && flexDates(data).includes(h.date) ? h.date : null;
}

// Zwraca mapę data -> id szablonu.
export function computeLayout(data, settings) {
  const flex = { ...data.schedule.flexDefault };
  const td = ticketDateOf(data, settings);
  if (td) {
    const slot = slotOf(settings.hypogeum);
    const southDate = Object.keys(flex).find(d => flex[d] === 'SOUTH_NONE');
    const vallDate = Object.keys(flex).find(d => flex[d] === 'VALLETTA');
    if (td === vallDate) {
      flex[td] = 'VALLETTA_H' + slot;
    } else if (td === southDate) {
      flex[td] = 'SOUTH_H' + slot;
    } else {
      const prev = flex[td];
      flex[td] = 'SOUTH_H' + slot;
      flex[southDate] = prev;
    }
  }
  const applied = [];
  const skipped = [];
  for (const [a, b] of settings.swaps || []) {
    if (!(a in flex) || !(b in flex) || a === b) continue;
    if (a === td || b === td) {
      skipped.push([a, b]);
      continue;
    }
    [flex[a], flex[b]] = [flex[b], flex[a]];
    applied.push([a, b]);
  }
  return { map: { ...data.schedule.fixed, ...flex }, ticketDate: td, applied, skipped };
}

function shiftTime(t, by) {
  return by ? fromMin(toMin(t) + by) : t;
}

// Składa dzień do wyświetlenia.
export function computeDay(data, settings, layout, date) {
  const tid = layout.map[date];
  const tpl = data.templates[tid];
  const flex = flexDates(data);
  const td = layout.ticketDate;
  const noTicket = !td;
  const attemptOk = noTicket && flex.includes(addDays(date, 1));

  const cond = sw => {
    switch (sw) {
      case undefined:
      case null:
      case '':
        return true;
      case 'hypogeum:none':
        return noTicket;
      case 'hypogeum:ticket':
        return !noTicket;
      case 'attempt':
        return attemptOk;
      case 'noAttempt':
        return !attemptOk;
      default:
        return true;
    }
  };

  const mk = it => ({ ...it, key: `${tid}.${it.id}`, tid });

  let blocks = tpl.blocks.map(b => ({
    location: b.location,
    transfer: b.transfer && cond(b.transfer.task?.showWhen) ? mk(b.transfer) : null,
    items: b.items.filter(i => cond(i.task?.showWhen)).map(mk)
  }));

  const hasAttempt = blocks.some(
    b => (b.transfer && b.transfer.task?.lastMinute) || b.items.some(i => i.task?.lastMinute)
  );

  // Próba last-minute przypięta do daty (czwartek -> bilety na piątek), +60 min dla reszty dnia.
  const at = data.hypogeum.attemptThursday;
  let shift = 0;
  if (at && attemptOk && date === at.date && !hasAttempt) {
    shift = at.shift || 0;
    blocks = blocks.map(b => ({
      ...b,
      transfer: b.transfer ? { ...b.transfer, time: shiftTime(b.transfer.time, shift), shifted: shift } : null,
      items: b.items.map(i => ({ ...i, time: shiftTime(i.time, shift), shifted: shift }))
    }));
    blocks.unshift({
      location: at.location,
      transfer: null,
      items: [
        {
          id: at.id,
          key: `LM.${at.id}`,
          tid: 'LM',
          time: at.time,
          type: 'task',
          title: at.title,
          note: at.note,
          placeRef: at.placeRef,
          task: { lastMinute: true },
          injected: true
        }
      ]
    });
  }

  // Codzienne sprawdzenie sklepu online (tylko „Brak biletu”).
  const dc = data.hypogeum.dailyCheck;
  if (dc && noTicket && dc.dates.includes(date)) {
    const first = blocks[0];
    const firstTime = (first.transfer || first.items[0]).time;
    blocks.unshift({
      location: 'Rano',
      transfer: null,
      items: [
        {
          id: 'store',
          key: `LM.store.${date}`,
          tid: 'LM',
          time: firstTime,
          type: 'task',
          title: dc.title,
          note: dc.note,
          placeRef: data.hypogeum.placeRef,
          url: data.hypogeum.storeUrl,
          task: { store: true },
          injected: true
        }
      ]
    });
  }

  // Własna godzina tury Hypogeum.
  const h = settings.hypogeum;
  if (tpl.hypogeumSlot && h.slot === 'custom' && h.customTime) {
    for (const b of blocks) {
      b.items = b.items.map(i =>
        i.hypogeum ? { ...i, title: `Hypogeum – Wasza tura: ${h.customTime.replace(/^0/, '')}`, customTime: h.customTime } : i
      );
    }
  }

  for (const b of blocks) {
    const times = [b.transfer?.time, ...b.items.map(i => i.time)].filter(Boolean);
    b.start = times[0];
    b.end = times[times.length - 1];
  }

  const flat = [];
  for (const b of blocks) {
    if (b.transfer) flat.push(b.transfer);
    flat.push(...b.items);
  }

  const warnings = [...(tpl.warnings || [])];
  const wdw = tpl.weekdayWarnings?.[String(weekday(date))];
  if (wdw) warnings.unshift(wdw);

  // Propozycja zamiany przy złej pogodzie.
  let weather = null;
  if (tpl.outdoor && flex.includes(date) && date !== td) {
    const safe = data.schedule.weatherSafe || [];
    const cands = flex
      .filter(d => d !== date && d !== td && safe.includes(layout.map[d]))
      .sort((a, b) => Math.abs(dayDiff(a, date)) - Math.abs(dayDiff(b, date)) || (a < b ? -1 : 1));
    if (cands.length) weather = { with: cands[0], tid: layout.map[cands[0]] };
  }

  const changed = tid !== defaultTemplate(data, date);

  return {
    date,
    tid,
    tpl,
    title: tpl.title,
    blocks,
    flat,
    warnings,
    weather,
    shift,
    changed,
    isTicketDay: date === td,
    isFlex: flex.includes(date),
    outdoor: !!tpl.outdoor,
    alternative: tpl.alternative || null
  };
}

export function computeAll(data, settings) {
  const layout = computeLayout(data, settings);
  const days = tripDates(data).map(d => computeDay(data, settings, layout, d));
  return { layout, days };
}

// Data, w której jest dany szablon (dla listy rezerwacji).
export function dateOfTemplate(layout, tids) {
  const list = Array.isArray(tids) ? tids : [tids];
  return Object.keys(layout.map)
    .sort()
    .find(d => list.includes(layout.map[d])) || null;
}
