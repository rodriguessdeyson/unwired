import { describe, expect, it } from 'vitest';
import { DeviceInfo } from '../models';
import { identifyWifi, mergeWifiResponses, parseWifiResponse } from './wifi-protocol';

describe('parseWifiResponse', () => {
  it('com tcp, abre fluxo de dados e usa o id próprio', () => {
    expect(parseWifiResponse({ address: '192.168.0.57', response: 'UNWIRED_ACK;id=ab12;name=ESP32;tcp=8080' })).toEqual({
      id: 'wifi:ab12',
      name: 'ESP32',
      address: '192.168.0.57',
      kind: 'wifi',
      wifiMode: 'stream',
      port: 8080,
    });
  });

  it('sem tcp, é só comandos na porta 80', () => {
    const device = parseWifiResponse({ address: '10.0.0.2', response: 'UNWIRED_ACK;id=x;name=Fita' });
    expect(device?.wifiMode).toBe('http');
    expect(device?.port).toBeUndefined();
  });

  it('aceita outra porta HTTP', () => {
    expect(parseWifiResponse({ address: '10.0.0.2', response: 'UNWIRED_ACK;id=x;http=8081' })).toMatchObject({ wifiMode: 'http', port: 8081 });
  });

  it('nomes podem ter sinal de igual', () => {
    expect(parseWifiResponse({ address: '10.0.0.2', response: 'UNWIRED_ACK;id=x;name=A=B' })?.name).toBe('A=B');
  });

  it('aceita o formato antigo do Iluminus como só comandos', () => {
    expect(parseWifiResponse({ address: '192.168.0.42', response: 'ILUMINUS_ACK\n' })).toMatchObject({ id: 'wifi:iluminus:192.168.0.42', wifiMode: 'http' });
  });

  it('ignora outras respostas', () => {
    expect(parseWifiResponse({ address: '10.0.0.2', response: 'HELLO' })).toBeNull();
  });
});

describe('mergeWifiResponses', () => {
  it('quem responde aos dois formatos aparece uma vez, com os dados do protocolo unWired', () => {
    const merged = mergeWifiResponses([
      { address: '10.0.0.9', response: 'ILUMINUS_ACK' },
      { address: '10.0.0.9', response: 'UNWIRED_ACK;id=fita;name=Fita da sala' },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ id: 'wifi:fita', name: 'Fita da sala' });
  });
});

describe('identifyWifi', () => {
  const probe = (answers: { discover?: string; accepts?: (device: DeviceInfo) => boolean }) => ({
    discover: async () => (answers.discover ? [{ address: '10.0.0.5', response: answers.discover }] : []),
    test: async (device: DeviceInfo) => answers.accepts?.(device) ?? false,
  });

  it('usa a resposta da descoberta quando o IP responde', async () => {
    const device = await identifyWifi('10.0.0.5', 8080, probe({ discover: 'UNWIRED_ACK;id=a;name=Estufa;tcp=9000' }));
    expect(device).toMatchObject({ id: 'wifi:a', wifiMode: 'stream', port: 9000 });
  });

  it('sem resposta, tenta o fluxo TCP', async () => {
    const device = await identifyWifi('10.0.0.5', 8080, probe({ accepts: (d) => d.wifiMode === 'stream' }));
    expect(device).toMatchObject({ wifiMode: 'stream', port: 8080 });
  });

  it('sem TCP, cai para comandos HTTP', async () => {
    const device = await identifyWifi('10.0.0.5', 8080, probe({ accepts: (d) => d.wifiMode === 'http' }));
    expect(device?.wifiMode).toBe('http');
  });

  it('sem nada respondendo, devolve null', async () => {
    expect(await identifyWifi('10.0.0.5', 8080, probe({}))).toBeNull();
  });
});
