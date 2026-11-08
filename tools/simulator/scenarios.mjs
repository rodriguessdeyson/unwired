// Cada cenário representa um tipo de firmware. `line(i)` devolve a próxima
// mensagem, ou null quando não há nada a enviar nesse instante.

const wave = (i, base, amp, period, digits = 2) =>
  (base + amp * Math.sin(i / period) + amp * 0.2 * Math.sin(i / 2.3)).toFixed(digits);

const ending = '\r\n';

export const SCENARIOS = {
  chaves: {
    port: 9001,
    title: 'Nome e valor: blocos T e H',
    line: (i) => `T=${wave(i, 44, 18, 11)} H=${wave(i, 61, 6, 23)}${ending}`,
  },
  csv: {
    port: 9002,
    title: 'Valores separados: Canal 1, 2 e 3',
    line: (i) => `${wave(i, 12, 3, 9)},${wave(i, 3.3, 0.4, 17)},${wave(i, 512, 80, 13, 0)}${ending}`,
  },
  json: {
    port: 9003,
    title: 'JSON: blocos temp e umidade',
    line: (i) => `{"temp":${wave(i, 24, 4, 12)},"umidade":${wave(i, 58, 8, 20)},"estado":"ok"}${ending}`,
  },
  numero: {
    port: 9004,
    title: 'Um número por linha: bloco Valor',
    line: (i) => `${wave(i, 50, 30, 8)}${ending}`,
  },
  legado: {
    port: 9005,
    title: 'Legado: 5 bytes sem fim de linha (escolha "Legado" em Formato)',
    line: (i) => wave(i, 50, 30, 8).padStart(5, '0').slice(0, 5),
  },
  texto: {
    port: 9006,
    title: 'Só texto: nenhum bloco, só as linhas',
    interval: 2000,
    line: (i) => `${['Sistema pronto', 'Porta aberta', 'Estufa ligada', 'Erro 404'][i % 4]}${ending}`,
  },
  silencioso: {
    port: 9007,
    title: 'Silencioso: só transmite depois de LS',
    waitsForStart: true,
    line: (i) => `T=${wave(i, 44, 18, 11)} H=${wave(i, 61, 6, 23)}${ending}`,
  },
  parado: {
    port: 9008,
    title: 'Canal parado: H para de chegar depois de 8 s',
    line: (i) =>
      i < 40 ? `T=${wave(i, 44, 18, 11)} H=${wave(i, 61, 6, 23)}${ending}` : `T=${wave(i, 44, 18, 11)}${ending}`,
  },
  queda: {
    port: 9009,
    title: 'Queda: a conexão cai depois de 10 s',
    dropAfterMs: 10000,
    line: (i) => `T=${wave(i, 44, 18, 11)} H=${wave(i, 61, 6, 23)}${ending}`,
  },
  rapido: {
    port: 9010,
    title: 'Carga: cerca de 60 linhas por segundo, para testar a fluidez',
    interval: 10,
    line: (i) => `T=${wave(i, 44, 18, 41)} H=${wave(i, 61, 6, 83)}${ending}`,
  },
  xml: {
    port: 9011,
    title: 'XML: blocos temp e umidade, em atributos',
    line: (i) => `<leitura temp="${wave(i, 24, 4, 12)}" umidade="${wave(i, 58, 8, 20)}" estado="ok"/>${ending}`,
  },
};

const DEFAULT_INTERVAL = 200;

/**
 * Liga um cenário a uma conexão qualquer. Responde aos comandos como um firmware:
 * LS inicia, DS para e o resto volta como eco. Retorna as funções da conexão.
 */
export function runScenario(scenario, { write, close, log = () => undefined }) {
  let i = 0;
  let streaming = !scenario.waitsForStart;
  let pending = '';

  const timer = setInterval(() => {
    if (!streaming) return;
    const line = scenario.line(i++);
    if (line) write(line);
  }, scenario.interval ?? DEFAULT_INTERVAL);

  const dropTimer = scenario.dropAfterMs ? setTimeout(() => close(), scenario.dropAfterMs) : null;

  const handleCommand = (command) => {
    log(`recebeu "${command}"`);
    const upper = command.toUpperCase();
    if (upper === 'LS') streaming = true;
    if (upper === 'DS') streaming = false;
    write(upper === 'LS' || upper === 'DS' ? `OK${ending}` : `ECO ${command}${ending}`);
  };

  return {
    receive(text) {
      pending += text;
      const parts = pending.split(/\r\n|\n|\r/);
      pending = parts.pop() ?? '';
      for (const part of parts) if (part.trim()) handleCommand(part.trim());
    },
    stop() {
      clearInterval(timer);
      if (dropTimer) clearTimeout(dropTimer);
    },
  };
}
