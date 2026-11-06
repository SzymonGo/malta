// Test end-to-end (Playwright, iPhone, offline). Użycie:
//   node tests/e2e.mjs <katalog_z_kopią_strony> <port>
// Strona jest serwowana pod /malta/ (jak na GitHub Pages).
import { createRequire } from 'node:module';
const { chromium, devices } = createRequire(import.meta.url)('playwright');
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const siteRoot = process.argv[2];
const port = Number(process.argv[3] || 8765);
const shots = process.argv[4] || null;
const BASE = `http://localhost:${port}/malta/`;
const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: siteRoot, stdio: 'ignore' });
await new Promise(r => setTimeout(r, 800));

let failures = 0;
const ok = (cond, msg) => { console.log((cond ? '  ✓ ' : '  ✗ ') + msg); if (!cond) failures++; };

const browser = await chromium.launch();
const context = await browser.newContext({ ...devices['iPhone 13'] });
const page = await context.newPage();
const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', e => consoleErrors.push(String(e)));

try {
  console.log('1. Pierwsze uruchomienie online');
  await page.goto(BASE);
  await page.waitForSelector('.day-head h1');
  ok((await page.textContent('.day-head h1')).length > 0, 'widok Dziś się renderuje');
  ok(await page.evaluate(() => window.__malta.errors.length === 0), 'brak błędów walidacji danych');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15000 });
  await page.goto(BASE + '#/info');
  await page.waitForSelector('#offline-status.ok', { timeout: 30000 });
  ok(true, 'Info: ' + (await page.textContent('#offline-status')));
  const noHScroll = async () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  ok(await noHScroll(), 'brak poziomego przewijania (Info)');

  console.log('2. Offline');
  await context.setOffline(true);
  await page.goto(BASE + '#/plan');
  await page.waitForSelector('.daycard');
  ok((await page.$$('.daycard')).length === 8, 'Plan offline: 8 dni');
  await page.goto(BASE + '#/dzien/2026-11-09');
  await page.waitForSelector('.item');
  ok(await noHScroll(), 'brak poziomego przewijania (dzień)');
  await page.click('.item[data-open="RABAT_MDINA_DINGLI.catacombs"]');
  await page.waitForSelector('#sheet:not([hidden]) .gallery img');
  await page.waitForFunction(() => { const i = document.querySelector('#sheet .gallery img'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 10000 });
  ok(true, 'karta punktu offline ze zdjęciem');
  ok((await page.textContent('#sheet-body')).includes('Historia'), 'karta ma sekcję Historia');
  if (shots) await page.screenshot({ path: join(shots, 'sheet.png') });
  await page.click('.sheet-close');
  // wszystkie obrazy z cache
  const imgsOk = await page.evaluate(async () => {
    const r = await new Promise(res => { const ch = new MessageChannel(); ch.port1.onmessage = e => res(e.data); navigator.serviceWorker.controller.postMessage({ type: 'GET_ASSETS' }, [ch.port2]); });
    const c = await caches.open(r.version); let miss = 0; for (const u of r.assets) if (!(await c.match(u))) miss++; return { miss, total: r.assets.length };
  });
  ok(imgsOk.miss === 0, `wszystkie pliki w cache (${imgsOk.total})`);

  console.log('3. Checklista i odhaczenie');
  await page.check('.item[data-open="RABAT_MDINA_DINGLI.catacombs"] input[type=checkbox]', { force: true });
  await page.reload();
  await page.waitForSelector('.item');
  ok(await page.isChecked('.item[data-open="RABAT_MDINA_DINGLI.catacombs"] input'), 'odhaczenie przetrwało przeładowanie offline');
  ok((await page.textContent('[data-progress] .ptext')).startsWith('1/'), 'pasek postępu 1/…');

  console.log('4. Scenariusze Hypogeum');
  const flex = ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13'];
  const expect = {
    none: ['RABAT_MDINA_DINGLI', 'THREE_CITIES', 'GOZO', 'SOUTH_NONE', 'VALLETTA'],
    '2026-11-09': s => [`SOUTH_H${s}`, 'THREE_CITIES', 'GOZO', 'RABAT_MDINA_DINGLI', 'VALLETTA'],
    '2026-11-11': s => ['RABAT_MDINA_DINGLI', 'THREE_CITIES', `SOUTH_H${s}`, 'GOZO', 'VALLETTA'],
    '2026-11-12': s => ['RABAT_MDINA_DINGLI', 'THREE_CITIES', 'GOZO', `SOUTH_H${s}`, 'VALLETTA'],
    '2026-11-13': s => ['RABAT_MDINA_DINGLI', 'THREE_CITIES', 'GOZO', 'SOUTH_NONE', `VALLETTA_H${s}`]
  };
  // brak biletu – przez UI
  await page.goto(BASE + '#/ustawienia');
  await page.waitForSelector('#hypo-card');
  await page.check('input[name=hmode][value=none]', { force: true });
  await page.click('[data-action=save-hypo]');
  let st = await page.evaluate(() => ({ map: window.__malta.layout.map, days: window.__malta.days.map(d => ({ date: d.date, keys: d.flat.map(i => i.key), times: d.flat.map(i => i.time), shift: d.shift })) }));
  ok(JSON.stringify(flex.map(d => st.map[d])) === JSON.stringify(expect.none), 'brak biletu: domyślny układ');
  const tue = st.days.find(d => d.date === '2026-11-10');
  const wed = st.days.find(d => d.date === '2026-11-11');
  const thu = st.days.find(d => d.date === '2026-11-12');
  ok(tue.keys.includes('THREE_CITIES.lm') && !tue.keys.includes('THREE_CITIES.ferry'), 'wt: próba Fort St Elmo 7:30');
  ok(wed.keys.includes('GOZO.lm'), 'śr: próba w Cittadelli 9:00');
  ok(thu.keys.includes('LM.lmThu') && thu.shift === 60 && thu.times.includes('09:15'), 'czw: próba 8:00 i plan +60 min');
  ok(st.days.filter(d => d.keys.some(k => k.startsWith('LM.store.'))).length === 6, 'codzienne sprawdzenie sklepu (8–13.11)');
  const sorted = st.days.every(d => d.times.every((t, i) => i === 0 || d.times[i - 1] <= t));
  ok(sorted, 'godziny rosną w każdym dniu');
  // „Kupiliśmy bilet” z próby we wtorek -> podpowiedź środy
  await page.goto(BASE + '#/dzien/2026-11-10');
  await page.click('.item[data-open="THREE_CITIES.lm"] a.btn.accent');
  await page.waitForSelector('#hypo-card .banner.accent');
  ok((await page.inputValue('select[name=hdate]')) === '2026-11-11', '„Kupiliśmy bilet” podpowiada śr 11.11');

  for (const date of ['2026-11-09', '2026-11-11', '2026-11-12', '2026-11-13']) {
    for (const slot of ['12', '16']) {
      await page.goto(BASE + '#/ustawienia');
      await page.waitForSelector('#hypo-card');
      await page.check('input[name=hmode][value=ticket]', { force: true });
      await page.selectOption('select[name=hdate]', date);
      await page.check(`input[name=hslot][value="${slot}"]`, { force: true });
      await page.click('[data-action=save-hypo]');
      st = await page.evaluate(() => ({ map: window.__malta.layout.map, days: window.__malta.days.map(d => ({ date: d.date, keys: d.flat.map(i => i.key), times: d.flat.map(i => i.time) })) }));
      const got = flex.map(d => st.map[d]);
      const lm = st.days.some(d => d.keys.some(k => k.startsWith('LM.') || k.endsWith('.lm')));
      const sortedOk = st.days.every(d => d.times.every((t, i) => i === 0 || d.times[i - 1] <= t));
      ok(JSON.stringify(got) === JSON.stringify(expect[date](slot)) && !lm && sortedOk, `bilet ${date} ${slot}:00 → ${got.join(', ')}`);
      // każdy dzień się renderuje, karta Hypogeum pokazuje turę
      await page.goto(BASE + `#/dzien/${date}`);
      await page.waitForSelector('.item');
      const hk = st.days.find(d => d.date === date).keys.find(k => k.endsWith('.hypogeum'));
      await page.click(`.item[data-open="${hk}"]`);
      await page.waitForSelector('#sheet:not([hidden])');
      ok((await page.textContent('#sheet-body')).includes(`Wasza tura: ${slot}:00`), `  karta Hypogeum: tura ${slot}:00`);
      await page.click('.sheet-close');
    }
  }
  // inna godzina
  await page.goto(BASE + '#/ustawienia');
  await page.waitForSelector('#hypo-card');
  await page.check('input[name=hmode][value=ticket]', { force: true });
  await page.selectOption('select[name=hdate]', '2026-11-12');
  await page.check('input[name=hslot][value=custom]', { force: true });
  await page.fill('input[name=htime]', '15:00');
  await page.click('[data-action=save-hypo]');
  st = await page.evaluate(() => window.__malta.layout.map['2026-11-12']);
  ok(st === 'SOUTH_H16', 'inna godzina 15:00 → wariant 16');
  await page.goto(BASE + '#/dzien/2026-11-12');
  await page.click('.item[data-open="SOUTH_H16.hypogeum"]');
  ok((await page.textContent('#sheet-body')).includes('Wasza tura: 15:00'), 'karta Hypogeum pokazuje 15:00');
  if (shots) await page.screenshot({ path: join(shots, 'hypogeum.png') });
  await page.click('.sheet-close');

  console.log('5. Zamiana dni (brak biletu, pn ⇄ pt)');
  await page.goto(BASE + '#/ustawienia');
  await page.check('input[name=hmode][value=none]', { force: true });
  await page.click('[data-action=save-hypo]');
  await page.selectOption('select[name=swapA]', '2026-11-09');
  await page.selectOption('select[name=swapB]', '2026-11-13');
  await page.click('[data-action=swap]');
  st = await page.evaluate(() => window.__malta.layout.map);
  ok(st['2026-11-09'] === 'VALLETTA' && st['2026-11-13'] === 'RABAT_MDINA_DINGLI', 'pn = Valletta, pt = Rabat/Mdina/Dingli');
  await page.goto(BASE + '#/dzien/2026-11-13');
  await page.waitForSelector('.item');
  ok(await page.isChecked('.item[data-open="RABAT_MDINA_DINGLI.catacombs"] input'), 'odhaczenie poszło za szablonem na piątek');
  ok(!!(await page.$('.banner.weather')), 'baner pogodowy na dniu plenerowym');
  if (shots) await page.screenshot({ path: join(shots, 'day-swapped.png'), fullPage: false });
  // bilet na dzień z zamianą usuwa zamianę
  await page.goto(BASE + '#/ustawienia');
  await page.check('input[name=hmode][value=ticket]', { force: true });
  await page.selectOption('select[name=hdate]', '2026-11-13');
  await page.check('input[name=hslot][value="12"]', { force: true });
  await page.click('[data-action=save-hypo]');
  st = await page.evaluate(() => ({ map: window.__malta.layout.map, swaps: window.__malta.settings.swaps }));
  ok(st.swaps.length === 0 && st.map['2026-11-13'] === 'VALLETTA_H12', 'bilet na dzień z zamianą: zamiana usunięta');
  await page.click('[data-action=reset-settings]').catch(() => {});

  console.log('6. Eksport / import');
  page.on('dialog', d => d.accept());
  await page.goto(BASE + '#/ustawienia');
  await page.click('[data-action=export]');
  const exported = await page.inputValue('#export-text');
  ok(exported.includes('"malta-2026"'), 'eksport zawiera dane');
  await page.click('[data-action=reset-checks]');
  ok(await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('malta26.checks'))).length === 0), 'reset odhaczeń');
  await page.fill('#import-text', exported);
  await page.click('[data-action=import]');
  ok(await page.evaluate(() => !!JSON.parse(localStorage.getItem('malta26.checks'))['RABAT_MDINA_DINGLI.catacombs']), 'import przywrócił odhaczenia');

  console.log('7. Jedzenie / Info / Dziś offline');
  for (const r of ['jedzenie', 'info', 'dzis']) {
    await page.goto(BASE + '#/' + r);
    await page.waitForSelector('main .card, main .day-head');
    ok(await noHScroll(), `brak poziomego przewijania (${r})`);
    if (shots) await page.screenshot({ path: join(shots, `${r}.png`) });
  }
  ok(!!(await page.$('.now-card')), 'karta Teraz/Następne');

  console.log('8. Aktualizacja (nowa wersja sw.js)');
  await context.setOffline(false);
  const swPath = join(siteRoot, 'malta', 'sw.js');
  writeFileSync(swPath, readFileSync(swPath, 'utf8').replace(/const VERSION = '([^']+)'/, "const VERSION = '$1-test'"));
  await page.goto(BASE + '#/plan');
  await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
  await page.waitForSelector('#update:not([hidden])', { timeout: 20000 });
  ok(true, 'baner „Nowa wersja” widoczny');
  await Promise.all([page.waitForEvent('load'), page.click('[data-action=reload-sw]')]);
  await page.waitForSelector('.daycard');
  ok(await page.evaluate(async () => (await caches.keys()).some(k => k.endsWith('-test'))), 'po odświeżeniu działa nowy cache');
} catch (err) {
  failures++;
  console.error('BŁĄD:', err);
}

const relevant = consoleErrors.filter(e => !/ERR_INTERNET_DISCONNECTED|Failed to load resource/.test(e));
ok(relevant.length === 0, 'brak błędów w konsoli' + (relevant.length ? ': ' + relevant.join(' | ') : ''));
await browser.close();
server.kill();
console.log(failures ? `\n${failures} błąd(ów)` : '\nWSZYSTKO OK');
process.exit(failures ? 1 : 0);
