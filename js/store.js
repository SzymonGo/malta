// Stan lokalny: odhaczenia i ustawienia. Każdy odczyt/zapis w try/catch;
// gdy localStorage nie działa, aplikacja pracuje na pamięci (do zamknięcia).

const K_CHECKS = 'malta26.checks';
const K_SETTINGS = 'malta26.settings';
const K_FLAGS = 'malta26.flags';

export const DEFAULT_SETTINGS = Object.freeze({
  hypogeum: { mode: 'none', date: '', slot: '12', customTime: '' },
  swaps: []
});

let storageWorks = true;

function read(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    storageWorks = false;
    return fallback;
  }
}

function write(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
    return true;
  } catch {
    storageWorks = false;
    return false;
  }
}

export function normalizeSettings(s) {
  const out = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  if (!s || typeof s !== 'object') return out;
  const h = s.hypogeum || {};
  out.hypogeum.mode = h.mode === 'ticket' ? 'ticket' : 'none';
  out.hypogeum.date = typeof h.date === 'string' ? h.date : '';
  out.hypogeum.slot = ['12', '16', 'custom'].includes(h.slot) ? h.slot : '12';
  out.hypogeum.customTime = /^\d{2}:\d{2}$/.test(h.customTime || '') ? h.customTime : '';
  if (Array.isArray(s.swaps)) {
    out.swaps = s.swaps
      .filter(p => Array.isArray(p) && p.length === 2 && p.every(d => /^\d{4}-\d{2}-\d{2}$/.test(d)))
      .map(p => [p[0], p[1]]);
  }
  return out;
}

let checks = read(K_CHECKS, {});
if (!checks || typeof checks !== 'object') checks = {};
let settings = normalizeSettings(read(K_SETTINGS, null));

export function storageOk() {
  return storageWorks;
}

export function isChecked(key) {
  return !!checks[key];
}

export function setChecked(key, val) {
  if (val) checks[key] = 1;
  else delete checks[key];
  write(K_CHECKS, checks);
}

export function getSettings() {
  return JSON.parse(JSON.stringify(settings));
}

export function saveSettings(s) {
  settings = normalizeSettings(s);
  write(K_SETTINGS, settings);
}

export function getFlag(name) {
  return read(K_FLAGS, {})[name];
}

export function setFlag(name, val) {
  const f = read(K_FLAGS, {});
  f[name] = val;
  write(K_FLAGS, f);
}

export function exportState() {
  return JSON.stringify({
    app: 'malta-2026',
    v: 1,
    exportedAt: new Date().toISOString(),
    settings,
    checks
  });
}

export function importState(text) {
  let obj;
  try {
    obj = JSON.parse(String(text).trim());
  } catch {
    return { ok: false, error: 'To nie jest poprawny JSON.' };
  }
  if (!obj || obj.app !== 'malta-2026' || typeof obj.checks !== 'object') {
    return { ok: false, error: 'To nie wygląda na eksport z tej aplikacji.' };
  }
  const clean = {};
  for (const [k, v] of Object.entries(obj.checks || {})) {
    if (v && typeof k === 'string' && k.length < 120) clean[k] = 1;
  }
  checks = clean;
  settings = normalizeSettings(obj.settings);
  write(K_CHECKS, checks);
  write(K_SETTINGS, settings);
  return { ok: true, count: Object.keys(clean).length };
}

export function resetChecks() {
  checks = {};
  write(K_CHECKS, checks);
}

export function resetSettings() {
  settings = normalizeSettings(null);
  write(K_SETTINGS, settings);
}

export function checkedCount() {
  return Object.keys(checks).length;
}
