import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os'; import { join } from 'node:path';
const [,, lang = 'pt', steps = 'all'] = process.argv;
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new','--remote-debugging-port=9333','--hide-scrollbars','--force-dark-mode',`--user-data-dir=${mkdtempSync(join(tmpdir(),'shots-'))}`,'about:blank']);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let ws; for (let i = 0; i < 40 && !ws; i++) { await sleep(250); try { const t = await (await fetch('http://127.0.0.1:9333/json')).json(); const p = t.find(x => x.type === 'page'); if (p) ws = p.webSocketDebuggerUrl; } catch {} }
const sock = new WebSocket(ws); await new Promise(r => sock.onopen = r);
let id = 0; const pend = new Map();
sock.onmessage = (m) => { const d = JSON.parse(m.data); if (pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } };
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); sock.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value;
await send('Emulation.setDeviceMetricsOverride', { width: 405, height: 720, deviceScaleFactor: 1080/405, mobile: true });
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
await send('Page.enable');
const go = async (path) => { await send('Page.navigate', { url: 'http://localhost:4311' + path }); await sleep(2500); };
const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(new URL(`raw/${lang}-${name}.png`, import.meta.url), Buffer.from(r.result.data, 'base64')); console.log('saved', name); };
// clica no elemento visível mais interno que contém o texto
const click = (text) => ev(`(()=>{const all=[...document.querySelectorAll('button,a,ion-tab-button,[role=button],li,div,span')].filter(e=>e.offsetParent!==null&&e.textContent.trim().includes(${JSON.stringify(text)}));const el=all.find(e=>!all.some(o=>o!==e&&e.contains(o)));if(!el)return 'miss';(el.closest('button,a,ion-tab-button,[role=button]')||el).click();return 'ok'})()`);
await go('/');
await ev(`localStorage.setItem('CapacitorStorage.settings', JSON.stringify({onboarded:true,lang:'${lang}'})); 1`);
globalThis.ctx = { go, shot, click, ev, sleep, send };
const script = (await import('./steps.mjs')).default;
await script(globalThis.ctx, lang, steps);
sock.close(); chrome.kill();
process.exit(0);
