// Regeneruje listę plików w sw.js (między // <assets> a // </assets>).
// Użycie: node tools/update-sw.mjs          – tylko lista
//         node tools/update-sw.mjs --bump   – lista + podbicie wersji cache (malta-vN -> malta-vN+1)
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const list = (dir, re) => (existsSync(join(root, dir)) ? readdirSync(join(root, dir)).filter(f => re.test(f)).sort().map(f => `${dir}/${f}`) : []);

const core = ['./', 'index.html', 'styles.css', 'app.js', 'manifest.webmanifest', 'data/trip.json', ...list('js', /\.js$/), ...list('icons', /\.png$/)];
const images = list('img', /\.(jpe?g|png|webp)$/i);

const fmt = arr => `[\n${arr.map(s => `  '${s}'`).join(',\n')}\n]`;
let sw = readFileSync(join(root, 'sw.js'), 'utf8');
sw = sw.replace(/\/\/ <assets>[\s\S]*?\/\/ <\/assets>/, `// <assets> (lista generowana przez tools/update-sw.mjs)\nconst CORE = ${fmt(core)};\nconst IMAGES = ${fmt(images)};\n// </assets>`);
if (process.argv.includes('--bump')) {
  sw = sw.replace(/const VERSION = 'malta-v(\d+)';/, (_, n) => `const VERSION = 'malta-v${Number(n) + 1}';`);
}
writeFileSync(join(root, 'sw.js'), sw);
console.log(sw.match(/const VERSION = '([^']+)'/)[1], `core=${core.length}`, `images=${images.length}`);
