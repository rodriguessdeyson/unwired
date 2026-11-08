#!/usr/bin/env node
// Dispositivos falsos para testar o unWired sem hardware, sem instalar nada.
// Uso e opções: node tools/simulator/simulator.mjs --ajuda
import dgram from 'node:dgram';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import { parseArgs } from 'node:util';
import { runScenario, SCENARIOS } from './scenarios.mjs';

const { values: options } = parseArgs({
  options: {
    ajuda: { type: 'boolean', default: false },
    cenario: { type: 'string', default: 'chaves' },
    com: { type: 'string' },
    iluminus: { type: 'boolean', default: false },
    'so-comandos': { type: 'boolean', default: false },
    'porta-http': { type: 'string', default: '80' },
    'porta-descoberta': { type: 'string', default: '4210' },
  },
});

const HELP = `
Simulador do unWired

  node tools/simulator/simulator.mjs                  Wi-Fi: todos os cenários, HTTP e descoberta
  node tools/simulator/simulator.mjs --cenario csv    Escolhe o cenário anunciado na descoberta
  node tools/simulator/simulator.mjs --so-comandos    A descoberta responde sem tcp=, e o app abre só comandos
  node tools/simulator/simulator.mjs --iluminus       A descoberta responde no formato antigo, ILUMINUS_ACK
  node tools/simulator/simulator.mjs --com COM7 --cenario csv
                                                      Bluetooth clássico pela porta COM de entrada do Windows

Cenários:
${Object.entries(SCENARIOS)
  .map(([name, scenario]) => `  ${name.padEnd(11)} porta ${scenario.port}  ${scenario.title}`)
  .join('\n')}
`;

if (options.ajuda) {
  console.log(HELP);
  process.exit(0);
}

const chosen = SCENARIOS[options.cenario];
if (!chosen) {
  console.error(`Cenário desconhecido: ${options.cenario}\n${HELP}`);
  process.exit(1);
}

const time = () => new Date().toTimeString().slice(0, 8);
const log = (tag, message) => console.log(`${time()} [${tag}] ${message}`);

function localAddresses() {
  return Object.entries(os.networkInterfaces())
    .filter(([name]) => !/vEthernet|WSL|Loopback|VMware|VirtualBox/i.test(name))
    .flatMap(([, addresses]) => addresses ?? [])
    .filter((address) => address.family === 'IPv4' && !address.internal)
    .map((address) => address.address);
}

function startTcp(name, scenario) {
  const server = net.createServer((socket) => {
    const tag = `${name}:${scenario.port}`;
    log(tag, `conectado (${socket.remoteAddress})`);
    socket.setEncoding('utf8');
    socket.setNoDelay(true);
    const run = runScenario(scenario, {
      write: (text) => socket.writable && socket.write(text),
      close: () => {
        log(tag, 'derrubando a conexão de propósito');
        socket.destroy();
      },
      log: (message) => log(tag, message),
    });
    socket.on('data', (text) => run.receive(text));
    socket.on('close', () => {
      run.stop();
      log(tag, 'desconectado');
    });
    socket.on('error', () => undefined);
  });
  server.on('error', (error) => log(name, `porta ${scenario.port} indisponível: ${error.code}`));
  server.listen(scenario.port);
}

function startHttp(port) {
  const server = http.createServer((request, response) => {
    const ok = request.url.startsWith('/set?c=');
    log('http', `${request.url} -> ${ok ? 200 : 404}`);
    response.statusCode = ok ? 200 : 404;
    response.end(ok ? 'OK' : 'Not found');
  });
  server.on('error', (error) => log('http', `porta ${port} indisponível: ${error.code}. O modo HTTP do app usa a 80.`));
  server.listen(port, () => log('http', `comandos HTTP em /set?c=... na porta ${port}`));
}

function startDiscovery(port) {
  const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
  socket.on('message', (message, remote) => {
    const text = message.toString().trim();
    const wanted = options.iluminus ? 'DISCOVER_ILUMINUS' : 'DISCOVER_UNWIRED';
    if (text !== wanted) return;
    const reply = options.iluminus
      ? 'ILUMINUS_ACK'
      : options['so-comandos']
        ? 'UNWIRED_ACK;id=sim-comandos;name=Simulador comandos'
        : `UNWIRED_ACK;id=sim-${options.cenario};name=Simulador ${options.cenario};tcp=${chosen.port}`;
    log('descoberta', `${text} de ${remote.address} -> ${reply}`);
    socket.send(reply, remote.port, remote.address);
  });
  socket.on('error', (error) => log('descoberta', `porta ${port} indisponível: ${error.code}`));
  socket.bind(port);
}

/** A porta COM de entrada do Windows entrega o que chega pelo RFCOMM do Bluetooth. */
function startCom(portName) {
  const path = `\\\\.\\${portName}`;
  let fd;
  try {
    fd = fs.openSync(path, 'r+');
  } catch (error) {
    console.error(`Não abriu ${portName}: ${error.code}. Crie a porta de entrada no Windows; veja tools/README.md.`);
    process.exit(1);
  }
  const tag = portName;
  log(tag, `cenário ${options.cenario}: ${chosen.title}`);
  log(tag, 'aguardando o app. No celular, pareie com este PC e conecte em Buscar dispositivos.');
  const run = runScenario(chosen, {
    write: (text) => {
      try {
        fs.writeSync(fd, text);
      } catch {
        // Sem app conectado a escrita falha; segue tentando até alguém conectar.
      }
    },
    close: () => log(tag, 'A queda não se aplica à porta COM.'),
    log: (message) => log(tag, message),
  });
  const buffer = Buffer.alloc(256);
  const readNext = () => {
    fs.read(fd, buffer, 0, buffer.length, null, (error, count) => {
      if (!error && count > 0) run.receive(buffer.toString('utf8', 0, count));
      setTimeout(readNext, error ? 500 : 0);
    });
  };
  readNext();
}

if (options.com) {
  startCom(options.com);
} else {
  for (const [name, scenario] of Object.entries(SCENARIOS)) startTcp(name, scenario);
  startHttp(Number(options['porta-http']));
  startDiscovery(Number(options['porta-descoberta']));

  const addresses = localAddresses();
  console.log(`\nSimulador no ar. No app: Buscar dispositivos > Adicionar Wi-Fi por IP.`);
  console.log(`IP deste PC: ${addresses.join(', ') || 'nenhum encontrado'}\n`);
  console.log('Modo Fluxo TCP, porta:');
  for (const [name, scenario] of Object.entries(SCENARIOS)) {
    console.log(`  ${String(scenario.port).padEnd(6)}${name.padEnd(12)}${scenario.title}`);
  }
  console.log(`\nModo Comandos HTTP: só o IP, porta ${options['porta-http']}.`);
  console.log(
    options.iluminus
      ? 'A busca do app encontra este PC no formato antigo (ILUMINUS_ACK), como só comandos.\n'
      : options['so-comandos']
        ? 'A busca do app encontra este PC como "Simulador comandos", só comandos.\n'
        : `A busca do app encontra este PC como "Simulador ${options.cenario}".\n`,
  );
}
