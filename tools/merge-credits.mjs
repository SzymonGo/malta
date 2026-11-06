// Przenosi atrybucje zdjęć z img/credits.json do data/trip.json (places[id].images).
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const credits = JSON.parse(readFileSync(join(root, 'img/credits.json'), 'utf8'));
const tripPath = join(root, 'data/trip.json');
const trip = JSON.parse(readFileSync(tripPath, 'utf8'));
let n = 0;
for (const [id, imgs] of Object.entries(credits)) {
  if (!trip.places[id]) { console.warn('brak miejsca', id); continue; }
  trip.places[id].images = imgs.map(({ file, author, license, licenseUrl, source, caption, title }) => ({ file, author, license, licenseUrl, source, caption, title }));
  n += imgs.length;
}
writeFileSync(tripPath, JSON.stringify(trip, null, 1) + '\n');
console.log('scalono zdjęć:', n);
