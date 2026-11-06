// Drobne narzędzia: escape HTML, daty, godziny.

export function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function toMin(t) {
  const [h, m] = String(t).split(':').map(Number);
  return h * 60 + (m || 0);
}

export function fromMin(min) {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

// 07:30 -> 7:30
export function fmtTime(t) {
  return String(t || '').replace(/^0(\d)/, '$1');
}

export const WD_SHORT = ['nd', 'pn', 'wt', 'śr', 'czw', 'pt', 'sb'];
export const WD_LONG = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];
const MONTHS_GEN = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'];

export function parseDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

export function dateStr(dt) {
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

export function weekday(s) {
  return parseDate(s).getDay();
}

export function addDays(s, n) {
  const dt = parseDate(s);
  dt.setDate(dt.getDate() + n);
  return dateStr(dt);
}

export function dayDiff(a, b) {
  return Math.round((parseDate(a) - parseDate(b)) / 86400000);
}

export function fmtShort(s) {
  const dt = parseDate(s);
  return `${WD_SHORT[dt.getDay()]} ${dt.getDate()}.${dt.getMonth() + 1}`;
}

export function fmtLong(s) {
  const dt = parseDate(s);
  return `${WD_LONG[dt.getDay()]}, ${dt.getDate()} ${MONTHS_GEN[dt.getMonth()]}`;
}

export function todayStr(now = new Date()) {
  return dateStr(now);
}

export function nowMin(now = new Date()) {
  return now.getHours() * 60 + now.getMinutes();
}

export function fmtDuration(min) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function clone(o) {
  return JSON.parse(JSON.stringify(o));
}
