const T = {
  pt: { open: 'Abrir sessão', chart: 'Gráfico', split: 'Dividido', settings: 'Ajustes do gráfico', sep: 'Um gráfico por canal', devices: 'Dispositivos', adj: 'Ajustes' },
  en: { open: 'Open session', chart: 'Chart', split: 'Split', settings: 'Chart settings', sep: 'One chart per channel', devices: 'Devices', adj: 'Settings' },
  es: { open: 'Abrir sesión', chart: 'Gráfico', split: 'Dividido', settings: 'Ajustes del gráfico', sep: 'Un gráfico por canal', devices: 'Dispositivos', adj: 'Ajustes' },
};
export default async ({ go, shot, click, ev, sleep }, lang) => {
  const t = T[lang];
  const label = (l) => ev(`(()=>{const e=[...document.querySelectorAll('[aria-label]')].find(e=>e.offsetParent!==null&&e.getAttribute('aria-label')===${JSON.stringify(l)});if(!e)return 'miss';e.click();return 'ok'})()`);
  await go('/busca'); await sleep(8000); await shot('4-busca');
  await click('ESP32 Sensor'); await sleep(4000);
  await click(t.open); await sleep(30000);
  await shot('2-sessao');
  console.log('chart', await click(t.chart)); await sleep(1500);
  
  console.log('sep', await label(t.sep)); await sleep(1000);
  await ev(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}));1`);
  console.log(await ev(`[...document.querySelectorAll('[aria-label]')].filter(e=>e.offsetParent!==null).map(e=>e.getAttribute('aria-label')).join('|')`));
  await sleep(4000); await shot('1-grafico');
  await click(t.devices); await sleep(3000); await shot('3-dispositivos');
  await click(t.adj); await sleep(3000); await shot('5-ajustes');
};
