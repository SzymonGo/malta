// Renderowanie widoków. Każda funkcja zwraca HTML (string).

import { esc, fmtTime, fmtShort, fmtLong, toMin, nowMin, todayStr, fmtDuration, dayDiff, addDays } from './util.js';
import { isChecked, storageOk } from './store.js';
import { mapsPin, mapsRoute, whatsapp, tel } from './links.js';
import { dateOfTemplate, flexDates, slotOf } from './schedule.js';

export const TYPE_ICON = { see: '🏛️', eat: '🍽️', transport: '🚌', task: '📝', buy: '🛍️', view: '🌅', free: '☕' };
export const TYPE_LABEL = {
  see: 'Atrakcja',
  eat: 'Jedzenie',
  transport: 'Transport',
  task: 'Do załatwienia',
  buy: 'Zakupy',
  view: 'Widok',
  free: 'Czas wolny'
};
export const MODE_ICON = { ferry: '⛴️', bus: '🚌', walk: '🚶', bolt: '🚕', lift: '🛗', plane: '✈️', boat: '🚤' };
export const MODE_LABEL = { ferry: 'Prom', bus: 'Autobus', walk: 'Pieszo', bolt: 'Bolt', lift: 'Winda', plane: 'Samolot', boat: 'Łódź' };

const FOOD_GROUPS = ['Sliema i okolice', 'Valletta', 'Marsaxlokk', 'Rabat i Mdina', 'Birgu', 'Gozo', 'Blue Grotto'];

const verifyChip = (txt = 'sprawdź w Tallinja / na stronie') => `<span class="verify">⚠️ ${esc(txt)}</span>`;

function itemIcon(it) {
  if (it.type === 'transport' && it.getThere?.mode) return MODE_ICON[it.getThere.mode] || TYPE_ICON.transport;
  return TYPE_ICON[it.type] || '•';
}

export function checkbox(key, label) {
  return `<label class="chk" aria-label="${esc(label || 'Odhacz')}"><input type="checkbox" data-key="${esc(key)}"${
    isChecked(key) ? ' checked' : ''
  }><span class="box" aria-hidden="true"></span></label>`;
}

export function dayProgress(day) {
  const total = day.flat.length;
  const done = day.flat.filter(i => isChecked(i.key)).length;
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

function progressBar(day) {
  const p = dayProgress(day);
  return `<div class="progress" data-progress="${esc(day.date)}" role="progressbar" aria-valuemin="0" aria-valuemax="${p.total}" aria-valuenow="${p.done}">
    <div class="bar"><span style="width:${p.pct}%"></span></div>
    <span class="ptext">${p.done}/${p.total}</span>
  </div>`;
}

function getThereLine(gt) {
  if (!gt) return '';
  const parts = [MODE_LABEL[gt.mode] || ''];
  if (gt.minutes) parts.push(fmtDuration(gt.minutes));
  if (gt.cost) parts.push(gt.cost);
  return parts.filter(Boolean).join(' · ');
}

function ticketHintDate(data, day) {
  const next = addDays(day.date, 1);
  return flexDates(data).includes(next) ? next : '';
}

// ---------- Dzień ----------

function renderItem(it, day, data) {
  const place = it.placeRef ? data.places[it.placeRef] : null;
  const sub = it.note || place?.short || '';
  const done = isChecked(it.key);
  const lm = it.task?.lastMinute || it.task?.store;
  const tags = [];
  if (it.optional) tags.push('<span class="tag">opcja</span>');
  if (it.shifted) tags.push(`<span class="tag">+${it.shifted} min</span>`);
  if (it.verify || place?.verify) tags.push('<span class="tag warn">⚠️ sprawdź</span>');
  let extra = '';
  if (it.task?.lastMinute) {
    const hint = ticketHintDate(data, day);
    extra = `<span class="it-actions"><a class="btn small accent" href="#/ustawienia?bilet=${esc(hint)}">🎟️ Kupiliśmy bilet</a></span>`;
  } else if (it.task?.store) {
    extra = `<span class="it-actions"><a class="btn small" href="${esc(it.url)}" target="_blank" rel="noopener" data-ext>Sklep online ↗</a><a class="btn small accent" href="#/ustawienia?bilet=">🎟️ Kupiliśmy bilet</a></span>`;
  }
  return `<div class="item t-${esc(it.type)}${done ? ' done' : ''}${lm ? ' lm' : ''}${it.optional ? ' opt' : ''}" data-open="${esc(it.key)}" role="button" tabindex="0">
    <span class="it-time">${esc(fmtTime(it.time))}</span>
    <span class="it-ic" aria-hidden="true">${itemIcon(it)}</span>
    <span class="it-body">
      <span class="it-title">${esc(it.title)}</span>
      ${sub ? `<span class="it-note">${esc(sub)}</span>` : ''}
      ${tags.length ? `<span class="tags">${tags.join('')}</span>` : ''}
      ${extra}
    </span>
    ${checkbox(it.key, it.title)}
  </div>`;
}

function renderTransfer(tr) {
  const gt = tr.getThere || {};
  const done = isChecked(tr.key);
  return `<div class="transfer${done ? ' done' : ''}" data-open="${esc(tr.key)}" role="button" tabindex="0">
    <span class="tr-time">${esc(fmtTime(tr.time))}</span>
    <span class="tr-ic" aria-hidden="true">${MODE_ICON[gt.mode] || '🚌'}</span>
    <span class="tr-body">
      <span class="tr-title">${esc(tr.title)}${tr.shifted ? ` <span class="tag">+${tr.shifted} min</span>` : ''}</span>
      <span class="tr-meta">${esc(getThereLine(gt))}</span>
      ${tr.verify ? '<span class="tags"><span class="tag warn">⚠️ sprawdź w Tallinja</span></span>' : ''}
    </span>
    ${checkbox(tr.key, tr.title)}
  </div>`;
}

export function renderDayHeader(day, data, opts = {}) {
  const chips = [`<span class="chip">🌅 zachód ok. ${esc(data.meta.sunset)}</span>`];
  if (day.outdoor) chips.push('<span class="chip">🌤️ plener</span>');
  if (day.isTicketDay) chips.push('<span class="chip accent">🎟️ Hypogeum</span>');
  if (day.changed) chips.push('<span class="chip">⇄ zmieniony układ</span>');
  if (day.shift) chips.push(`<span class="chip">⏱️ +${day.shift} min (próba last-minute)</span>`);

  let weather = '';
  if (day.weather) {
    const w = data.templates[day.weather.tid];
    weather = `<div class="banner weather">
      <div><b>Pada lub wieje?</b> Zamień z dniem: ${esc(fmtShort(day.weather.with))} – ${esc(w.title)}.
      <small>Przy silnym wietrze prom na Gozo i łódź w Blue Grotto mogą nie kursować.</small></div>
      <button class="btn small" data-action="swap-now" data-a="${esc(day.date)}" data-b="${esc(day.weather.with)}">Zamień</button>
    </div>`;
  }

  let alt = '';
  if (day.alternative) {
    alt = `<details class="alt"><summary>${esc(day.alternative.title)}${day.alternative.verify ? ' ⚠️' : ''}</summary>
      <ol>${day.alternative.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
      ${day.alternative.verify ? verifyChip() : ''}
    </details>`;
  }

  return `<section class="day-head">
    <div class="day-date">${esc(fmtLong(day.date))}${opts.badge ? ` · <span class="today-badge">${esc(opts.badge)}</span>` : ''}</div>
    <h1>${esc(day.title)}</h1>
    <div class="chips">${chips.join('')}</div>
    ${progressBar(day)}
    ${day.warnings.length ? `<ul class="warnings">${day.warnings.map(w => `<li>${esc(w)}</li>`).join('')}</ul>` : ''}
    ${weather}
    ${alt}
  </section>`;
}

export function renderDayBody(day, data) {
  return day.blocks
    .map(b => {
      const tr = b.transfer ? renderTransfer(b.transfer) : '';
      return `${tr}<section class="block">
        <header class="block-head"><span class="loc">📍 ${esc(b.location)}</span><span class="range">${esc(fmtTime(b.start))}${
          b.end && b.end !== b.start ? '–' + esc(fmtTime(b.end)) : ''
        }</span></header>
        <div class="items">${b.items.map(it => renderItem(it, day, data)).join('')}</div>
      </section>`;
    })
    .join('');
}

export function renderDay(day, data, opts = {}) {
  const nav = opts.nav
    ? `<nav class="daynav">
        ${opts.nav.prev ? `<a class="btn small ghost" href="#/dzien/${esc(opts.nav.prev)}">‹ ${esc(fmtShort(opts.nav.prev))}</a>` : '<span></span>'}
        <a class="btn small ghost" href="#/plan">Wszystkie dni</a>
        ${opts.nav.next ? `<a class="btn small ghost" href="#/dzien/${esc(opts.nav.next)}">${esc(fmtShort(opts.nav.next))} ›</a>` : '<span></span>'}
      </nav>`
    : '';
  return `${nav}${renderDayHeader(day, data, opts)}${renderDayBody(day, data)}${nav}`;
}

// ---------- Teraz / Następne ----------

export function renderNowCard(days, data, now = new Date()) {
  const t = todayStr(now);
  const first = days[0];
  const last = days[days.length - 1];
  const row = (label, it, day, extra = '') =>
    it
      ? `<div class="now-row" data-open="${esc(it.key)}" role="button" tabindex="0">
          <span class="now-label">${label}</span>
          <span class="now-main"><b>${esc(fmtTime(it.time))}</b> ${itemIcon(it)} ${esc(it.title)}${extra ? ` <span class="now-extra">${extra}</span>` : ''}${
            day && day.date !== t ? ` <span class="now-extra">(${esc(fmtShort(day.date))})</span>` : ''
          }</span>
        </div>`
      : '';

  if (t < first.date) {
    const n = dayDiff(first.date, t);
    return `<section class="now-card">
      <div class="now-title">Do wyjazdu: ${n} ${n === 1 ? 'dzień' : 'dni'}</div>
      ${row('Pierwszy punkt', first.flat[0], first)}
      <p class="muted small">Przed wylotem: zainstalujcie aplikację i sprawdźcie w Info, czy jest „Gotowe offline”.</p>
    </section>`;
  }
  if (t > last.date) {
    return `<section class="now-card"><div class="now-title">Wyjazd zakończony</div><p class="muted">Pokazuję ostatni dzień planu.</p></section>`;
  }
  const idx = days.findIndex(d => d.date === t);
  const day = days[idx];
  const nm = nowMin(now);
  let cur = null;
  let next = null;
  for (const it of day.flat) {
    if (toMin(it.time) <= nm) cur = it;
    else {
      next = it;
      break;
    }
  }
  let nextDay = day;
  if (!next && days[idx + 1]) {
    nextDay = days[idx + 1];
    next = nextDay.flat[0];
  }
  const inMin = next && nextDay === day ? toMin(next.time) - nm : null;
  return `<section class="now-card">
    ${cur ? row('Teraz', cur, day) : `<div class="now-row"><span class="now-label">Teraz</span><span class="now-main muted">Dzień jeszcze się nie zaczął</span></div>`}
    ${next ? row('Następne', next, nextDay, inMin != null ? `za ${fmtDuration(inMin)}` : '') : `<div class="now-row"><span class="now-label">Następne</span><span class="now-main muted">To już koniec planu</span></div>`}
  </section>`;
}

// ---------- Plan ----------

export function renderPlan(days, data) {
  return `<h1 class="page-title">Plan</h1>
  <ul class="daylist">${days
    .map(d => {
      const p = dayProgress(d);
      const chips = [];
      if (d.isTicketDay) chips.push('🎟️');
      if (d.outdoor) chips.push('🌤️');
      if (d.changed) chips.push('⇄');
      return `<li><a class="daycard" href="#/dzien/${esc(d.date)}">
        <span class="dc-date">${esc(fmtShort(d.date))}</span>
        <span class="dc-body"><span class="dc-title">${esc(d.title)}</span>
          <span class="dc-meta">${p.done}/${p.total} ${chips.join(' ')}</span>
          <span class="bar"><span style="width:${p.pct}%"></span></span>
        </span>
        <span class="dc-arrow" aria-hidden="true">›</span>
      </a></li>`;
    })
    .join('')}</ul>
  <p class="muted small">🎟️ Hypogeum · 🌤️ plener (przy złej pogodzie można zamienić) · ⇄ zmieniony układ</p>`;
}

// ---------- Karta punktu / miejsca ----------

function imagesHtml(place) {
  const imgs = place.images || [];
  if (!imgs.length) return '';
  return `<div class="gallery${imgs.length > 1 ? ' multi' : ''}">${imgs
    .map(
      (im, i) => `<figure>
        <img src="${esc(im.file)}" alt="${esc(im.caption || place.name)}" loading="lazy" decoding="async">
        <figcaption>${imgs.length > 1 ? `<b>${i + 1}/${imgs.length}</b> ` : ''}${esc(im.caption || '')} · Fot. ${esc(im.author)}, <a href="${esc(
          im.source
        )}" target="_blank" rel="noopener" data-ext>${esc(im.license)}</a></figcaption>
      </figure>`
    )
    .join('')}</div>`;
}

function actionButtons(place, item) {
  const btns = [];
  if (place) {
    const mode = item?.getThere?.mode === 'walk' ? 'walking' : 'transit';
    btns.push(`<a class="btn primary" href="${esc(mapsRoute(place, mode))}" target="_blank" rel="noopener" data-ext>🧭 Trasa</a>`);
    btns.push(`<a class="btn" href="${esc(mapsPin(place))}" target="_blank" rel="noopener" data-ext>📍 Na mapie</a>`);
    if (place.url) btns.push(`<a class="btn" href="${esc(place.url)}" target="_blank" rel="noopener" data-ext>🌐 Strona</a>`);
    if (place.whatsapp) btns.push(`<a class="btn" href="${esc(whatsapp(place.whatsapp))}" target="_blank" rel="noopener" data-ext>💬 Rezerwacja (WhatsApp)</a>`);
    if (place.phone) btns.push(`<a class="btn" href="${esc(tel(place.phone))}">📞 Zadzwoń</a>`);
  }
  if (item?.url) btns.push(`<a class="btn" href="${esc(item.url)}" target="_blank" rel="noopener" data-ext>🛒 Sklep online</a>`);
  btns.push(`<a class="btn" href="https://bolt.eu" data-bolt>🚕 Bolt</a>`);
  return `<div class="btn-row">${btns.join('')}</div>`;
}

function infoGrid(place) {
  const rows = [
    ['Godziny', place.hours],
    ['Ceny', place.price],
    ['Czas', place.duration],
    ['Adres', place.address]
  ].filter(r => r[1] && r[1] !== '–');
  if (!rows.length) return '';
  return `<dl class="info-grid">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`;
}

function placeSections(place, pid, data, foodRefs) {
  let html = '';
  html += infoGrid(place);
  if (place.verify) html += `<p>${verifyChip('sprawdź godziny / ceny na stronie')}</p>`;
  if (place.warnings?.length) html += `<h3>Uwaga</h3><ul class="warnings">${place.warnings.map(w => `<li>${esc(w)}</li>`).join('')}</ul>`;
  if (place.history) html += `<h3>Historia</h3><p class="history">${esc(place.history)}</p>`;
  if (place.facts?.length) html += `<h3>Ciekawostki</h3><ul class="facts">${place.facts.map(f => `<li>${esc(f)}</li>`).join('')}</ul>`;
  if (place.see?.length) {
    html += `<h3>Co zobaczyć</h3><ul class="checklist">${place.see
      .map((s, i) => {
        const key = `see.${pid}.${i}`;
        return `<li class="${isChecked(key) ? 'done' : ''}">${checkbox(key, s)}<span>${esc(s)}</span></li>`;
      })
      .join('')}</ul>`;
  }
  const food = (foodRefs || place.food || []).filter(f => data.places[f] && f !== pid);
  if (food.length) {
    html += `<h3>Co zjeść w pobliżu</h3><ul class="foodrefs">${food
      .map(f => {
        const fp = data.places[f];
        return `<li><button class="linklike" data-place="${esc(f)}">${esc(fp.name)}${fp.star ? ' ★' : ''}</button> <span class="muted">– ${esc(fp.short || '')}</span></li>`;
      })
      .join('')}</ul>`;
  }
  return html;
}

export function renderItemSheet(entry, data, ctx) {
  const { item, day, prevTransfer } = entry;
  const place = item.placeRef ? data.places[item.placeRef] : null;
  let html = `<div class="sh-kicker">${esc(fmtShort(day.date))} · ${esc(fmtTime(item.time))} · ${itemIcon(item)} ${esc(TYPE_LABEL[item.type] || '')}</div>
    <h2>${esc(item.title)}</h2>
    ${place && place.name !== item.title ? `<div class="sh-place">${esc(place.name)}${place.area ? ' · ' + esc(place.area) : ''}</div>` : ''}
    <div class="sh-check">${checkbox(item.key, item.title)}<span>Zrobione</span></div>`;
  if (place) html += imagesHtml(place);
  if (item.note) html += `<p class="note">${esc(item.note)}</p>`;
  if (item.verify) html += `<p>${verifyChip()}</p>`;

  if (item.task?.lastMinute || item.hypogeum || item.task?.store) {
    const h = data.hypogeum;
    if (item.hypogeum) {
      const s = ctx.settings.hypogeum;
      const own = s.slot === 'custom' && s.customTime ? s.customTime : `${slotOf(s)}:00`;
      html += `<div class="banner accent"><b>Wasza tura: ${esc(own.replace(/^0/, ''))}</b>${
        s.slot === 'custom' ? `<br><small>Plan dnia ułożony pod turę ${slotOf(s)}:00 – przesuńcie sąsiednie punkty.</small>` : ''
      }</div>`;
    }
    if (item.task?.lastMinute || item.task?.store) {
      const hint = item.task?.lastMinute ? ticketHintDate(data, day) : '';
      html += `<div class="banner accent">
        <a class="btn accent" href="#/ustawienia?bilet=${esc(hint)}" data-close>🎟️ Kupiliśmy bilet${hint ? ` (na ${esc(fmtShort(hint))})` : ''}</a>
      </div>`;
    }
    html += `<h3>Bilety last-minute do Hypogeum</h3><ul>${h.rules.map(r => `<li>${esc(r)}</li>`).join('')}</ul>
      <p><a class="btn" href="${esc(h.storeUrl)}" target="_blank" rel="noopener" data-ext>🛒 Sklep online Heritage Malta</a></p>`;
  }

  html += actionButtons(place, item);

  const gt = item.getThere || (prevTransfer ? prevTransfer.getThere : null);
  if (gt) {
    html += `<h3>Jak dojechać</h3><div class="getthere">${MODE_ICON[gt.mode] || ''} <b>${esc(getThereLine(gt))}</b><br>${esc(gt.text || '')}${
      !item.getThere && prevTransfer ? `<br><small class="muted">(${esc(fmtTime(prevTransfer.time))} – ${esc(prevTransfer.title)})</small>` : ''
    }</div>`;
  }

  if (place) html += placeSections(place, item.placeRef, data, item.food && item.food.length ? [...item.food, ...(place.food || [])] : null);

  for (const extra of item.alsoRefs || []) {
    const p = data.places[extra];
    if (p) html += `<h3>Zobacz też</h3><p><button class="linklike" data-place="${esc(extra)}">${esc(p.name)}</button> <span class="muted">– ${esc(p.short || '')}</span></p>`;
  }
  return html;
}

export function renderPlaceSheet(pid, data) {
  const place = data.places[pid];
  if (!place) return '<p>Brak danych.</p>';
  let html = `<div class="sh-kicker">${place.kind === 'food' ? '🍽️ Jedzenie' : '📍 Miejsce'}${place.area ? ' · ' + esc(place.area) : ''}</div>
    <h2>${esc(place.name)}${place.star ? ' ★' : ''}</h2>`;
  html += imagesHtml(place);
  if (place.short) html += `<p class="note">${esc(place.short)}</p>`;
  html += actionButtons(place, null);
  html += placeSections(place, pid, data, null);
  return html;
}

// ---------- Jedzenie ----------

export function renderFood(data) {
  const byGroup = {};
  for (const [pid, p] of Object.entries(data.places)) {
    if (p.kind !== 'food') continue;
    (byGroup[p.foodGroup || p.area] ||= []).push([pid, p]);
  }
  const groups = [...FOOD_GROUPS, ...Object.keys(byGroup).filter(g => !FOOD_GROUPS.includes(g))].filter(g => byGroup[g]);
  const list = groups
    .map(
      g => `<section class="card">
      <h2>${esc(g)}</h2>
      <ul class="foodlist">${byGroup[g]
        .sort((a, b) => (b[1].star ? 1 : 0) - (a[1].star ? 1 : 0))
        .map(
          ([pid, p]) => `<li>
          <button class="food-name linklike" data-place="${esc(pid)}">${esc(p.name)}${p.star ? ' <span class="star">★</span>' : ''}</button>
          <div class="muted small">${esc(p.area)}${p.price ? ' · ' + esc(p.price) : ''}${p.hours ? ' · ' + esc(p.hours) : ''}</div>
          <div>${esc(p.short || '')}${p.verify ? ' ⚠️' : ''}</div>
          <div class="btn-row compact">
            <a class="btn small" href="${esc(mapsRoute(p, 'walking'))}" target="_blank" rel="noopener" data-ext>🧭 Trasa</a>
            <a class="btn small" href="${esc(mapsPin(p))}" target="_blank" rel="noopener" data-ext>📍 Mapa</a>
            ${p.url ? `<a class="btn small" href="${esc(p.url)}" target="_blank" rel="noopener" data-ext>🌐 Strona</a>` : ''}
            ${p.whatsapp ? `<a class="btn small" href="${esc(whatsapp(p.whatsapp))}" target="_blank" rel="noopener" data-ext>💬 WhatsApp</a>` : ''}
            ${p.phone ? `<a class="btn small" href="${esc(tel(p.phone))}">📞 Tel.</a>` : ''}
          </div>
        </li>`
        )
        .join('')}</ul>
    </section>`
    )
    .join('');

  const checklist = (items, prefix) =>
    `<ul class="checklist">${items
      .map(i => {
        const key = `${prefix}.${i.id}`;
        return `<li class="${isChecked(key) ? 'done' : ''}">${checkbox(key, i.name)}<span><b>${esc(i.name)}</b>${i.desc ? ` – ${esc(i.desc)}` : ''}</span></li>`;
      })
      .join('')}</ul>`;

  return `<h1 class="page-title">Jedzenie</h1>
    <p class="muted small">★ = polecajka znajomych. Tap w nazwę otwiera kartę lokalu.</p>
    ${list}
    <section class="card"><h2>Spróbujcie</h2>${checklist(data.eatList, 'eat')}</section>
    <section class="card"><h2>Kupić w markecie ★</h2>${checklist(data.marketList, 'market')}
      <p class="muted small">${esc(data.marketNote || '')}</p></section>`;
}

// ---------- Info ----------

export function renderInfo(data, ctx) {
  const hotel = data.places[data.hotel.placeRef];
  const layout = ctx.layout;

  const bookings = data.bookings
    .map(b => {
      let when = '';
      if (b.date) when = fmtShort(b.date);
      else if (b.templateRef) {
        const d = dateOfTemplate(layout, b.templateRef);
        when = d ? fmtShort(addDays(d, b.offset || 0)) + (b.offset ? ' (dzień przed)' : '') : 'nie ma w obecnym planie';
      }
      const p = data.places[b.placeRef];
      const key = `book.${b.id}`;
      const links = [];
      if (b.url) links.push(`<a class="btn small" href="${esc(b.url)}" target="_blank" rel="noopener" data-ext>Sklep</a>`);
      if (p?.whatsapp) links.push(`<a class="btn small" href="${esc(whatsapp(p.whatsapp))}" target="_blank" rel="noopener" data-ext>WhatsApp</a>`);
      if (p?.phone) links.push(`<a class="btn small" href="${esc(tel(p.phone))}">Tel.</a>`);
      if (p?.url && !b.url) links.push(`<a class="btn small" href="${esc(p.url)}" target="_blank" rel="noopener" data-ext>Strona</a>`);
      return `<li class="${isChecked(key) ? 'done' : ''}">${checkbox(key, b.text)}<span><b>${esc(b.text)}</b>${when ? ` <span class="muted">· ${esc(when)}</span>` : ''}
        ${links.length ? `<span class="btn-row compact">${links.join('')}</span>` : ''}</span></li>`;
    })
    .join('');

  const textList = list =>
    `<ul class="plain">${list
      .map(
        x =>
          `<li>${esc(x.text)}${x.url ? ` <a href="${esc(x.url)}" target="_blank" rel="noopener" data-ext>link ↗</a>` : ''}${x.verify ? ' ' + verifyChip() : ''}</li>`
      )
      .join('')}</ul>`;

  // Lista punktów do sprawdzenia
  const verifyList = [];
  for (const [pid, p] of Object.entries(data.places)) if (p.verify) verifyList.push(`${p.name} – godziny / ceny / rozkład`);
  for (const [tid, t] of Object.entries(data.templates)) {
    for (const b of t.blocks) {
      for (const it of [b.transfer, ...b.items].filter(Boolean)) {
        if (it.verify) verifyList.push(`${t.title}: ${fmtTime(it.time)} ${it.title}`);
      }
    }
    if (t.alternative?.verify) verifyList.push(`${t.title}: ${t.alternative.title}`);
  }

  const credits = [];
  for (const p of Object.values(data.places)) {
    for (const im of p.images || []) {
      credits.push(
        `<li>${esc(p.name)}: ${esc(im.caption || '')} – ${esc(im.author)}, <a href="${esc(im.source)}" target="_blank" rel="noopener" data-ext>${esc(
          im.license
        )}</a> (Wikimedia Commons)</li>`
      );
    }
  }

  return `<h1 class="page-title">Info</h1>
  <section class="card" id="offline-card">
    <h2>Tryb offline</h2>
    <div id="offline-status" class="offline-status">Sprawdzam…</div>
    <div class="progress hidden" id="offline-progress"><div class="bar"><span style="width:0%"></span></div><span class="ptext"></span></div>
    <div class="btn-row"><button class="btn" data-action="offline-check">🔄 Sprawdź i pobierz brakujące pliki</button></div>
    <p class="muted small" id="persist-status"></p>
  </section>

  <section class="card">
    <h2>🏨 Hotel</h2>
    <p><b>${esc(hotel.name)}</b><br>${esc(hotel.address)}</p>
    <p class="muted small">${esc(hotel.short)}</p>
    <div class="btn-row">
      <a class="btn primary" href="${esc(mapsRoute(hotel, 'transit'))}" target="_blank" rel="noopener" data-ext>🧭 Trasa do hotelu</a>
      <a class="btn" href="${esc(mapsPin(hotel))}" target="_blank" rel="noopener" data-ext>📍 Na mapie</a>
      <a class="btn" href="https://bolt.eu" data-bolt>🚕 Bolt</a>
    </div>
  </section>

  <section class="card"><h2>🚌 Transport i ceny</h2>${textList(data.transport)}</section>

  <section class="card"><h2>📅 Do zarezerwowania</h2><ul class="checklist">${bookings}</ul>
    <p class="muted small">Daty liczone z aktualnego układu dni (scenariusz Hypogeum, zamiany).</p></section>

  <section class="card"><h2>🎟️ Hypogeum – bilety last-minute</h2>
    <ul>${data.hypogeum.rules.map(r => `<li>${esc(r)}</li>`).join('')}</ul>
    <div class="btn-row"><a class="btn" href="${esc(data.hypogeum.storeUrl)}" target="_blank" rel="noopener" data-ext>🛒 Sklep online</a>
    <a class="btn" href="#/ustawienia">⚙️ Scenariusz</a></div>
  </section>

  <section class="card"><h2>💡 Praktyczne</h2>${textList(data.practical)}</section>

  <section class="card"><h2>📲 Instalacja i offline (iPhone)</h2>
    <ol>
      <li>Otwórzcie stronę w <b>Safari</b> (nie w innej przeglądarce).</li>
      <li>Przycisk <b>Udostępnij</b> → <b>Dodaj do ekranu początkowego</b> → Dodaj.</li>
      <li>Otwórzcie aplikację <b>z ikony</b>, będąc online, i poczekajcie na komunikat <b>„Gotowe offline”</b> (sprawdzicie go też tutaj, w karcie „Tryb offline”).</li>
      <li>Test: włączcie <b>tryb samolotowy</b> i otwórzcie aplikację z ikony – plan, karty i zdjęcia powinny działać.</li>
    </ol>
    <p class="muted small">Aplikacja z ekranu początkowego ma osobną pamięć niż Safari – odhaczenia z Safari nie przechodzą do ikony (i odwrotnie). Odhaczenia są osobno na każdym telefonie; do przeniesienia służy eksport/import w Ustawieniach.</p>
  </section>

  ${
    verifyList.length
      ? `<section class="card"><details><summary><b>⚠️ Do sprawdzenia na miejscu (${verifyList.length})</b></summary>
    <p class="muted small">Tych informacji nie udało się potwierdzić w oficjalnych źródłach. Rozkłady: Tallinja, godziny: strony obiektów.</p>
    <ul class="small">${verifyList.map(v => `<li>${esc(v)}</li>`).join('')}</ul></details></section>`
      : ''
  }

  ${
    credits.length
      ? `<section class="card"><details><summary><b>📷 Autorzy zdjęć (${credits.length})</b></summary><ul class="small">${credits.join('')}</ul>
    <p class="muted small">Wszystkie zdjęcia z Wikimedia Commons na wolnych licencjach.</p></details></section>`
      : ''
  }

  <p class="muted small center">Dane: wersja ${esc(String(data.version))} · <span id="cache-version"></span>${
    ctx.errors.length ? ` · <span class="warn">błędy danych: ${ctx.errors.length}</span>` : ''
  }</p>
  ${ctx.errors.length ? `<details class="small"><summary>Błędy walidacji</summary><ul>${ctx.errors.map(e => `<li>${esc(e)}</li>`).join('')}</ul></details>` : ''}`;
}

// ---------- Ustawienia ----------

export function renderSettings(data, ctx, hint) {
  const s = ctx.settings;
  const h = s.hypogeum;
  const flex = flexDates(data);
  const layout = ctx.layout;
  const td = layout.ticketDate;
  const hinted = hint !== undefined && hint !== null;
  const mode = hinted ? 'ticket' : h.mode;
  const selDate = hinted && flex.includes(hint) ? hint : h.date || flex[0];

  const layoutTable = flex
    .map(d => {
      const t = data.templates[layout.map[d]];
      return `<li><span class="lt-date">${esc(fmtShort(d))}</span><span>${esc(t.title)}</span>${d === td ? '<span class="lock">🔒🎟️</span>' : ''}</li>`;
    })
    .join('');

  const dayOpts = sel =>
    flex
      .map(
        d =>
          `<option value="${esc(d)}"${d === sel ? ' selected' : ''}${d === td ? ' disabled' : ''}>${esc(fmtShort(d))} – ${esc(
            data.templates[layout.map[d]].title
          )}${d === td ? ' (bilet)' : ''}</option>`
      )
      .join('');
  const swappable = flex.filter(d => d !== td);

  return `<h1 class="page-title">Ustawienia</h1>
  ${storageOk() ? '' : '<div class="banner warn">Pamięć urządzenia jest niedostępna – odhaczenia znikną po zamknięciu. Zróbcie eksport.</div>'}

  <section class="card" id="hypo-card">
    <h2>🎟️ Scenariusz Hypogeum</h2>
    ${
      hinted
        ? `<div class="banner accent">Super! ${
            hint ? `Bilet zapewne na <b>${esc(fmtShort(hint))}</b> – sprawdźcie dzień, wybierzcie turę i zapiszcie.` : 'Wybierzcie dzień i turę, potem zapiszcie.'
          }</div>`
        : ''
    }
    <div class="seg" role="radiogroup">
      <label><input type="radio" name="hmode" value="none"${mode === 'none' ? ' checked' : ''}> Brak biletu</label>
      <label><input type="radio" name="hmode" value="ticket"${mode === 'ticket' ? ' checked' : ''}> Mam bilet</label>
    </div>
    <div id="ticket-fields"${mode === 'ticket' ? '' : ' hidden'}>
      <label class="field">Dzień wizyty (pn–pt)
        <select name="hdate">${flex
          .map(d => `<option value="${esc(d)}"${d === selDate ? ' selected' : ''}>${esc(fmtShort(d))}</option>`)
          .join('')}</select>
      </label>
      <div class="field">Tura
        <div class="seg">
          <label><input type="radio" name="hslot" value="12"${h.slot === '12' ? ' checked' : ''}> 12:00</label>
          <label><input type="radio" name="hslot" value="16"${h.slot === '16' ? ' checked' : ''}> 16:00</label>
          <label><input type="radio" name="hslot" value="custom"${h.slot === 'custom' ? ' checked' : ''}> Inna</label>
        </div>
        <input type="time" name="htime" value="${esc(h.customTime)}" class="timeinput"${h.slot === 'custom' ? '' : ' hidden'} aria-label="Godzina tury">
        <small class="muted">Przy innej godzinie plan wybierze bliższy wariant (12 lub 16), a w karcie Hypogeum pokaże Waszą godzinę.</small>
      </div>
      <p class="muted small">Bilet na pt → piątek z Hypogeum w Valletcie. Bilet na czw → czwartek południowy z Hypogeum. Bilet na pn/wt/śr → ten dzień staje się dniem południowym, a jego dotychczasowy plan przechodzi na czwartek.</p>
    </div>
    <div class="btn-row"><button class="btn primary" data-action="save-hypo">Zapisz scenariusz</button></div>
    <h3>Aktualny układ pn–pt</h3>
    <ul class="layout">${layoutTable}</ul>
  </section>

  <section class="card">
    <h2>⇄ Zamiana dni (deszcz, wiatr)</h2>
    <p class="muted small">Zamieniacie całe plany dwóch dni. Odhaczenia zostają przy planach. Dzień z biletem do Hypogeum jest zablokowany.</p>
    <div class="swap-row">
      <select name="swapA" aria-label="Pierwszy dzień">${dayOpts(swappable[0])}</select>
      <span aria-hidden="true">⇄</span>
      <select name="swapB" aria-label="Drugi dzień">${dayOpts(swappable[1])}</select>
    </div>
    <div class="btn-row"><button class="btn primary" data-action="swap">Zamień dni</button>
    ${s.swaps.length ? `<button class="btn" data-action="clear-swaps">Cofnij wszystkie zamiany (${s.swaps.length})</button>` : ''}</div>
    ${
      layout.skipped.length
        ? `<p class="small warn">Pominięto ${layout.skipped.length} zamian(y) z dniem biletu.</p>`
        : ''
    }
  </section>

  <section class="card">
    <h2>💾 Eksport / import postępu</h2>
    <p class="muted small">Na wypadek wyczyszczenia danych albo żeby przenieść odhaczenia na drugi telefon (np. przez WhatsApp do siebie).</p>
    <div class="btn-row"><button class="btn" data-action="export">📋 Kopiuj postęp</button></div>
    <textarea id="export-text" readonly rows="3" placeholder="Tu pojawi się tekst eksportu" hidden></textarea>
    <textarea id="import-text" rows="3" placeholder="Wklejcie tu tekst eksportu"></textarea>
    <div class="btn-row"><button class="btn" data-action="import">📥 Importuj</button></div>
  </section>

  <section class="card">
    <h2>🧹 Reset</h2>
    <div class="btn-row">
      <button class="btn danger" data-action="reset-checks">Wyczyść wszystkie odhaczenia</button>
      <button class="btn danger" data-action="reset-settings">Przywróć domyślny plan</button>
    </div>
  </section>`;
}
