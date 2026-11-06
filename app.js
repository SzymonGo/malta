// Malta 7–14.11.2026 – offline PWA. Punkt wejścia.

import { todayStr, fmtShort } from './js/util.js';
import * as store from './js/store.js';
import { computeAll, flexDates } from './js/schedule.js';
import { validateData, validateDay } from './js/validate.js';
import { openBolt } from './js/links.js';
import {
  renderDay,
  renderNowCard,
  renderPlan,
  renderItemSheet,
  renderPlaceSheet,
  renderFood,
  renderInfo,
  renderSettings,
  dayProgress
} from './js/views.js';

const $ = sel => document.querySelector(sel);
const view = $('#view');
const sheet = $('#sheet');
const sheetBody = $('#sheet-body');
const toastEl = $('#toast');

const app = {
  data: null,
  settings: store.getSettings(),
  layout: null,
  days: [],
  registry: new Map(),
  errors: [],
  sheetStack: [],
  route: { name: 'dzis' }
};

// ---------- Dane ----------

async function loadData() {
  const res = await fetch('data/trip.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function recompute() {
  const { layout, days } = computeAll(app.data, app.settings);
  app.layout = layout;
  app.days = days;
  app.registry.clear();
  for (const day of days) {
    for (const b of day.blocks) {
      if (b.transfer) app.registry.set(b.transfer.key, { item: b.transfer, day, block: b, prevTransfer: null });
      for (const it of b.items) app.registry.set(it.key, { item: it, day, block: b, prevTransfer: b.transfer && b.items[0] === it ? b.transfer : null });
    }
  }
  const dayErrors = days.flatMap(validateDay);
  if (dayErrors.length) console.warn('Błędy w wyliczonym planie:', dayErrors);
}

function currentTripDate() {
  const t = todayStr();
  const dates = app.days.map(d => d.date);
  if (t < dates[0]) return dates[0];
  if (t > dates[dates.length - 1]) return dates[dates.length - 1];
  return t;
}

// ---------- Router ----------

function parseRoute() {
  const h = location.hash.replace(/^#\/?/, '');
  const [path, query = ''] = h.split('?');
  const parts = path.split('/').filter(Boolean);
  const params = new URLSearchParams(query);
  const name = parts[0] || 'dzis';
  return { name, arg: parts[1], params };
}

function setTab(name) {
  const tab = name === 'dzien' ? 'plan' : name;
  document.querySelectorAll('#tabs a').forEach(a => {
    const on = a.dataset.tab === tab;
    a.classList.toggle('active', on);
    if (on) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

function render({ keepScroll = false } = {}) {
  if (!app.data) return;
  const y = window.scrollY;
  const r = parseRoute();
  app.route = r;
  let html = '';
  const ctx = { settings: app.settings, layout: app.layout, errors: app.errors };

  switch (r.name) {
    case 'plan':
      html = renderPlan(app.days, app.data);
      break;
    case 'dzien': {
      const idx = app.days.findIndex(d => d.date === r.arg);
      if (idx < 0) {
        location.replace('#/plan');
        return;
      }
      const day = app.days[idx];
      html = renderDay(day, app.data, {
        nav: { prev: app.days[idx - 1]?.date, next: app.days[idx + 1]?.date },
        badge: day.date === todayStr() ? 'dziś' : ''
      });
      break;
    }
    case 'jedzenie':
      html = renderFood(app.data);
      break;
    case 'info':
      html = renderInfo(app.data, ctx);
      break;
    case 'ustawienia':
      html = renderSettings(app.data, ctx, r.params.has('bilet') ? r.params.get('bilet') : null);
      break;
    case 'dzis':
    default: {
      const date = currentTripDate();
      const day = app.days.find(d => d.date === date);
      html = renderNowCard(app.days, app.data) + renderDay(day, app.data, { badge: date === todayStr() ? 'dziś' : 'pierwszy dzień' });
      break;
    }
  }
  view.innerHTML = html;
  setTab(r.name === 'dzis' || !['plan', 'dzien', 'jedzenie', 'info', 'ustawienia'].includes(r.name) ? 'dzis' : r.name);
  window.scrollTo(0, keepScroll ? y : 0);
  if (r.name === 'info') updateOfflineCard();
  if (r.name === 'ustawienia' && r.params.has('bilet')) {
    $('#hypo-card')?.scrollIntoView({ block: 'start' });
  }
}

// ---------- Arkusz (karta punktu) ----------

function openSheet(html, push = true) {
  if (push && !sheet.hidden) app.sheetStack.push(sheetBody.innerHTML);
  sheetBody.innerHTML = (app.sheetStack.length ? '<button class="btn small ghost back" data-back>‹ Wróć</button>' : '') + html;
  sheet.hidden = false;
  document.documentElement.classList.add('sheet-open');
  $('#sheet-panel').scrollTop = 0;
}

function closeSheet() {
  sheet.hidden = true;
  app.sheetStack = [];
  document.documentElement.classList.remove('sheet-open');
}

function backSheet() {
  const prev = app.sheetStack.pop();
  if (prev == null) return closeSheet();
  sheetBody.innerHTML = prev;
  $('#sheet-panel').scrollTop = 0;
}

function openItem(key) {
  const entry = app.registry.get(key);
  if (!entry) return;
  app.sheetStack = [];
  openSheet(renderItemSheet(entry, app.data, { settings: app.settings }), false);
}

// ---------- Komunikaty ----------

let toastTimer;
function toast(msg, ms = 2600) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms);
}

function updateOnline() {
  $('#net').hidden = navigator.onLine;
}

// ---------- Zdarzenia ----------

function refreshProgress() {
  document.querySelectorAll('[data-progress]').forEach(el => {
    const day = app.days.find(d => d.date === el.dataset.progress);
    if (!day) return;
    const p = dayProgress(day);
    el.querySelector('.bar span').style.width = p.pct + '%';
    el.querySelector('.ptext').textContent = `${p.done}/${p.total}`;
    el.setAttribute('aria-valuenow', p.done);
  });
}

function onCheck(input) {
  const key = input.dataset.key;
  store.setChecked(key, input.checked);
  // Synchronizuj wszystkie checkboxy z tym kluczem (lista + arkusz).
  document.querySelectorAll(`input[data-key="${CSS.escape(key)}"]`).forEach(el => {
    el.checked = input.checked;
    const row = el.closest('.item, .transfer, li');
    if (row) row.classList.toggle('done', input.checked);
  });
  refreshProgress();
}

function saveSettings(next, msg) {
  store.saveSettings(next);
  app.settings = store.getSettings();
  recompute();
  if (msg) toast(msg);
}

function handleAction(el) {
  const a = el.dataset.action;
  const s = app.settings;
  switch (a) {
    case 'save-hypo': {
      const mode = view.querySelector('input[name=hmode]:checked')?.value || 'none';
      const date = view.querySelector('select[name=hdate]')?.value || '';
      const slot = view.querySelector('input[name=hslot]:checked')?.value || '12';
      const time = view.querySelector('input[name=htime]')?.value || '';
      if (mode === 'ticket' && slot === 'custom' && !time) {
        toast('Wpiszcie godzinę tury.');
        return;
      }
      s.hypogeum = { mode, date, slot, customTime: slot === 'custom' ? time : '' };
      const before = s.swaps.length;
      if (mode === 'ticket') s.swaps = s.swaps.filter(p => !p.includes(date));
      saveSettings(s, mode === 'ticket' ? `Zapisano: Hypogeum ${fmtShort(date)}` : 'Zapisano: brak biletu');
      if (before !== s.swaps.length) toast('Zapisano. Usunięto zamianę z dniem biletu.');
      location.hash = '#/ustawienia';
      render();
      break;
    }
    case 'swap': {
      const a1 = view.querySelector('select[name=swapA]').value;
      const b1 = view.querySelector('select[name=swapB]').value;
      if (a1 === b1) return toast('Wybierzcie dwa różne dni.');
      if (a1 === app.layout.ticketDate || b1 === app.layout.ticketDate) return toast('Dzień z biletem jest zablokowany.');
      s.swaps.push([a1, b1]);
      saveSettings(s, `Zamieniono ${fmtShort(a1)} ⇄ ${fmtShort(b1)}`);
      render({ keepScroll: true });
      break;
    }
    case 'swap-now': {
      const { a: d1, b: d2 } = el.dataset;
      if (!confirm(`Zamienić plany dni ${fmtShort(d1)} i ${fmtShort(d2)}?`)) return;
      s.swaps.push([d1, d2]);
      saveSettings(s, `Zamieniono ${fmtShort(d1)} ⇄ ${fmtShort(d2)}`);
      render({ keepScroll: true });
      break;
    }
    case 'clear-swaps':
      s.swaps = [];
      saveSettings(s, 'Cofnięto zamiany dni');
      render({ keepScroll: true });
      break;
    case 'export': {
      const txt = store.exportState();
      const ta = $('#export-text');
      ta.hidden = false;
      ta.value = txt;
      const fallback = () => {
        ta.focus();
        ta.select();
        toast('Zaznaczone – skopiujcie ręcznie (Kopiuj).');
      };
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(txt).then(() => toast('Skopiowano do schowka ✓'), fallback);
      else fallback();
      break;
    }
    case 'import': {
      const txt = $('#import-text').value;
      if (!txt.trim()) return toast('Najpierw wklejcie tekst eksportu.');
      if (!confirm('Import zastąpi obecne odhaczenia i ustawienia. Kontynuować?')) return;
      const res = store.importState(txt);
      if (!res.ok) return toast(res.error, 4000);
      app.settings = store.getSettings();
      recompute();
      render();
      toast(`Zaimportowano (${res.count} odhaczeń) ✓`);
      break;
    }
    case 'reset-checks':
      if (!confirm('Na pewno wyczyścić wszystkie odhaczenia?')) return;
      store.resetChecks();
      render({ keepScroll: true });
      toast('Wyczyszczono odhaczenia');
      break;
    case 'reset-settings':
      if (!confirm('Przywrócić domyślny plan (brak biletu, bez zamian)?')) return;
      store.resetSettings();
      app.settings = store.getSettings();
      recompute();
      render({ keepScroll: true });
      toast('Przywrócono domyślny plan');
      break;
    case 'offline-check':
      fillMissing(true);
      break;
    case 'reload-sw':
      applyUpdate();
      break;
  }
}

document.addEventListener('click', e => {
  const t = e.target;
  const bolt = t.closest('[data-bolt]');
  if (bolt) {
    e.preventDefault();
    if (!navigator.onLine) toast('Jesteście offline – Bolt wymaga internetu.');
    openBolt();
    return;
  }
  const ext = t.closest('a[data-ext]');
  if (ext) {
    if (!navigator.onLine) toast('Jesteście offline – link zadziała po połączeniu z internetem.', 3200);
    return;
  }
  const act = t.closest('[data-action]');
  if (act) {
    e.preventDefault();
    handleAction(act);
    return;
  }
  if (t.closest('[data-back]')) return backSheet();
  if (t.closest('[data-close]')) {
    closeSheet();
    return; // linki z data-close (np. „Kupiliśmy bilet”) działają dalej
  }
  if (t === sheet || t.classList.contains('sheet-backdrop')) return closeSheet();
  if (t.closest('.chk') || t.closest('a') || t.closest('input,select,textarea,label')) return;
  const place = t.closest('[data-place]');
  if (place) return openSheet(renderPlaceSheet(place.dataset.place, app.data));
  const open = t.closest('[data-open]');
  if (open) return openItem(open.dataset.open);
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !sheet.hidden) return closeSheet();
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-open]')) {
    e.preventDefault();
    openItem(e.target.dataset.open);
  }
});

document.addEventListener('change', e => {
  const t = e.target;
  if (t.matches('input[data-key]')) return onCheck(t);
  if (t.name === 'hmode') $('#ticket-fields').hidden = t.value !== 'ticket';
  if (t.name === 'hslot') view.querySelector('input[name=htime]').hidden = t.value !== 'custom';
});

window.addEventListener('hashchange', () => {
  closeSheet();
  render();
});
window.addEventListener('online', updateOnline);
window.addEventListener('offline', updateOnline);

// Odśwież „Teraz / Następne” co minutę.
setInterval(() => {
  if (app.route.name === 'dzis' && sheet.hidden && document.visibilityState === 'visible') render({ keepScroll: true });
}, 60000);

// ---------- Service worker i tryb offline ----------

let swReg = null;
let refreshing = false;

function swAsk(msg) {
  return new Promise((resolve, reject) => {
    const ctrl = navigator.serviceWorker?.controller;
    if (!ctrl) return reject(new Error('no controller'));
    const ch = new MessageChannel();
    const timer = setTimeout(() => reject(new Error('timeout')), 5000);
    ch.port1.onmessage = ev => {
      clearTimeout(timer);
      resolve(ev.data);
    };
    ctrl.postMessage(msg, [ch.port2]);
  });
}

let offlineState = { text: 'Sprawdzam…', ok: false };

function setOfflineStatus(text, ok = false) {
  offlineState = { text, ok };
  const el = $('#offline-status');
  if (el) {
    el.textContent = text;
    el.classList.toggle('ok', ok);
  }
}

function updateOfflineCard() {
  setOfflineStatus(offlineState.text, offlineState.ok);
  const pv = $('#persist-status');
  if (pv && app.persisted != null) pv.textContent = app.persisted ? 'Pamięć trwała: włączona.' : 'Pamięć trwała: przeglądarka nie potwierdziła (dane zwykle i tak zostają).';
  const cv = $('#cache-version');
  if (cv && app.cacheVersion) cv.textContent = `cache ${app.cacheVersion}`;
}

async function fillMissing(manual = false) {
  if (!('serviceWorker' in navigator) || !('caches' in window)) {
    setOfflineStatus('Ta przeglądarka nie obsługuje trybu offline.');
    return;
  }
  let info;
  try {
    info = await swAsk({ type: 'GET_ASSETS' });
  } catch {
    setOfflineStatus(manual ? 'Service worker jeszcze nie działa – otwórzcie aplikację ponownie (online).' : 'Przygotowuję tryb offline…');
    return;
  }
  app.cacheVersion = info.version;
  updateOfflineCard();
  const cache = await caches.open(info.version);
  const missing = [];
  for (const url of info.assets) if (!(await cache.match(url, { ignoreSearch: true }))) missing.push(url);
  if (!missing.length) {
    setOfflineStatus(`✓ Gotowe offline – ${info.assets.length} plików zapisanych (w tym zdjęcia).`, true);
    if (store.getFlag('offlineReady') !== info.version) {
      store.setFlag('offlineReady', info.version);
      toast('✓ Gotowe offline', 3500);
    }
    return;
  }
  if (!navigator.onLine) {
    setOfflineStatus(`Brakuje ${missing.length} z ${info.assets.length} plików. Połączcie się z internetem i spróbujcie ponownie.`);
    return;
  }
  const prog = $('#offline-progress');
  prog?.classList.remove('hidden');
  let done = 0;
  let failed = 0;
  for (const url of missing) {
    try {
      const res = await fetch(url, { cache: 'reload' });
      if (!res.ok) throw new Error(res.status);
      await cache.put(url, res);
    } catch {
      failed++;
    }
    done++;
    const p = $('#offline-progress');
    if (p) {
      p.querySelector('.bar span').style.width = Math.round((done / missing.length) * 100) + '%';
      p.querySelector('.ptext').textContent = `${done}/${missing.length}`;
    }
    setOfflineStatus(`Pobieram brakujące pliki… ${done}/${missing.length}`);
  }
  $('#offline-progress')?.classList.add('hidden');
  if (failed) setOfflineStatus(`Nie udało się pobrać ${failed} plików. Spróbujcie ponownie przy lepszym zasięgu.`);
  else fillMissing();
}

function showUpdate(worker) {
  const bar = $('#update');
  bar.hidden = false;
  bar.dataset.ready = '1';
  app.waiting = worker;
}

function applyUpdate() {
  const w = app.waiting || swReg?.waiting;
  if (w) w.postMessage({ type: 'SKIP_WAITING' });
  else location.reload();
}

async function registerSW() {
  if (!('serviceWorker' in navigator)) {
    setOfflineStatus('Ta przeglądarka nie obsługuje trybu offline.');
    return;
  }
  let hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) {
      hadController = true;
      fillMissing();
      return;
    }
    if (refreshing) return;
    refreshing = true;
    location.reload();
  });
  try {
    swReg = await navigator.serviceWorker.register('sw.js', { scope: './' });
  } catch (err) {
    setOfflineStatus('Nie udało się włączyć trybu offline: ' + err.message);
    return;
  }
  if (swReg.waiting && navigator.serviceWorker.controller) showUpdate(swReg.waiting);
  swReg.addEventListener('updatefound', () => {
    const nw = swReg.installing;
    if (!nw) return;
    nw.addEventListener('statechange', () => {
      if (nw.state === 'installed' && navigator.serviceWorker.controller) showUpdate(nw);
    });
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') swReg.update().catch(() => {});
  });
  await navigator.serviceWorker.ready;
  if (navigator.serviceWorker.controller) fillMissing();
}

async function requestPersist() {
  try {
    if (navigator.storage?.persist) {
      app.persisted = (await navigator.storage.persisted?.()) || (await navigator.storage.persist());
      updateOfflineCard();
    }
  } catch {
    /* brak wsparcia */
  }
}

// ---------- Start ----------

async function init() {
  updateOnline();
  try {
    app.data = await loadData();
  } catch (err) {
    view.innerHTML = `<div class="card"><h2>Nie udało się wczytać planu</h2><p>${String(err.message)}</p>
      <p>Jeśli to pierwsze uruchomienie, połączcie się z internetem i odświeżcie.</p></div>`;
    registerSW();
    return;
  }
  app.errors = validateData(app.data);
  if (app.errors.length) console.warn('Błędy danych:', app.errors);
  // Ustawienia z datą spoza dni elastycznych – wyczyść.
  if (app.settings.hypogeum.mode === 'ticket' && !flexDates(app.data).includes(app.settings.hypogeum.date)) {
    app.settings.hypogeum.mode = 'none';
  }
  recompute();
  if (!location.hash) history.replaceState(null, '', '#/dzis');
  render();
  registerSW();
  requestPersist();
}

// Do testów automatycznych.
window.__malta = app;

init();
