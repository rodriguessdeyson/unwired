// Gera mipmap-*/ic_launcher.png e ic_launcher_round.png (Android 7.0 e 7.1) a partir de launcher.html.
// Renderiza em 512 px e reduz no recorte da captura: o Chrome headless não abre janela pequena.
// Uso: node tools/store-art/launcher-icons.mjs [caminho do chrome]
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const chromePath = process.argv[2] ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const page = fileURLToPath(new URL('launcher.html', import.meta.url));
const res = fileURLToPath(new URL('../../android/app/src/main/res/', import.meta.url));
const sizes = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
const port = 9341;

const chrome = spawn(chromePath, ['--headless=new', `--remote-debugging-port=${port}`, '--hide-scrollbars', `--user-data-dir=${mkdtempSync(join(tmpdir(), 'launcher-'))}`, 'about:blank']);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws;
for (let i = 0; i < 40 && !ws; i++) {
  await sleep(250);
  try {
    const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
    ws = targets.find((t) => t.type === 'page')?.webSocketDebuggerUrl;
  } catch {}
}
const sock = new WebSocket(ws);
await new Promise((r) => (sock.onopen = r));
let id = 0;
const pending = new Map();
sock.onmessage = (m) => {
  const d = JSON.parse(m.data);
  pending.get(d.id)?.(d);
  pending.delete(d.id);
};
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); sock.send(JSON.stringify({ id: i, method, params })); });

await send('Emulation.setDeviceMetricsOverride', { width: 512, height: 512, deviceScaleFactor: 1, mobile: false });
await send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
for (const [shape, name] of [['square', 'ic_launcher'], ['round', 'ic_launcher_round']]) {
  await send('Page.navigate', { url: pathToFileURL(page).href + '?shape=' + shape });
  await sleep(500);
  for (const [density, px] of Object.entries(sizes)) {
    const shot = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 512, height: 512, scale: px / 512 } });
    writeFileSync(`${res}mipmap-${density}/${name}.png`, Buffer.from(shot.result.data, 'base64'));
    console.log(`mipmap-${density}/${name}.png`);
  }
}
sock.close();
chrome.kill();
process.exit(0);
