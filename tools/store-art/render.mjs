// Renderiza ícone, banners e capturas finais em tools/store-art/out/.
// Antes, gere as telas com: node tools/store-art/shots.mjs <pt|en|es>
// Uso: node tools/store-art/render.mjs [caminho do chrome]
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const chrome = process.argv[2] ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const here = fileURLToPath(new URL('.', import.meta.url));
const out = here + 'out/';
mkdirSync(out, { recursive: true });

const render = (page, file, width, height) => {
  const url = pathToFileURL(here + page.split('?')[0]).href + (page.includes('?') ? '?' + page.split('?')[1] : '');
  execFileSync(chrome, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', '--virtual-time-budget=3000', `--window-size=${width},${height}`, `--screenshot=${out}${file}`, url], { stdio: 'ignore' });
  console.log(file);
};

render('icon.html', 'icon.png', 512, 512);
for (const lang of ['pt', 'en', 'es']) {
  render(`feature.html?lang=${lang}`, `${lang}-featureGraphic.png`, 1024, 500);
  for (let n = 1; n <= 5; n++) render(`compose.html?lang=${lang}&n=${n}`, `${lang}-${n}.png`, 1080, 1920);
}
