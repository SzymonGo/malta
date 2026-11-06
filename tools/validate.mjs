// Walidacja danych + wszystkich scenariuszy Hypogeum. Użycie: node tools/validate.mjs
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateData, validateDay } from '../js/validate.js';
import { computeAll, flexDates } from '../js/schedule.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const data = JSON.parse(readFileSync(join(root, 'data/trip.json'), 'utf8'));
const errors = validateData(data);
const scenarios = [{ mode: 'none', date: '', slot: '12' }];
for (const d of flexDates(data)) for (const slot of ['12', '16']) scenarios.push({ mode: 'ticket', date: d, slot });
for (const h of scenarios) {
  const { days, layout } = computeAll(data, { hypogeum: { customTime: '', ...h }, swaps: [] });
  for (const day of days) errors.push(...validateDay(day));
  const label = h.mode === 'none' ? 'brak biletu' : `${h.date} ${h.slot}:00`;
  console.log(label.padEnd(18), flexDates(data).map(d => layout.map[d]).join(' | '));
}
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('OK – brak błędów');
