import { DeviceInfo } from '../models';
import { NativeWifiDevice } from './native-serial';

/**
 * Protocolo Wi-Fi do unWired, versão 1.
 *
 * 1. O app envia por broadcast UDP, na porta de descoberta (4210), a mensagem `DISCOVER_UNWIRED`.
 * 2. O dispositivo responde para o endereço e a porta de origem:
 *    `UNWIRED_ACK;id=<id fixo>;name=<nome>[;tcp=<porta>][;http=<porta>]`
 * 3. Com `tcp`, o app abre um fluxo TCP nos dois sentidos: uma leitura por linha, com gráfico e terminal.
 *    Sem `tcp`, cada comando vira `GET /set?c=<comando>` na porta `http` (padrão 80), e o
 *    dispositivo responde 200. O comando vai como está, então `L&r=255` chega como c=L e r=255.
 *    Para testar a conexão, o app envia o comando CHECK.
 *
 * Por compatibilidade, o app também envia `DISCOVER_ILUMINUS` e aceita `ILUMINUS_ACK`, que equivale a
 * uma resposta sem `tcp`, na porta HTTP 80.
 */
export const DISCOVERY_MESSAGES = ['DISCOVER_UNWIRED', 'DISCOVER_ILUMINUS'];
export const HTTP_DEFAULT_PORT = 80;
export const CHECK_COMMAND = 'CHECK';

function validPort(text: string | undefined): number | undefined {
  const port = Number(text);
  return Number.isInteger(port) && port > 0 && port < 65536 ? port : undefined;
}

/** Converte a resposta da descoberta em dispositivo, ou null se não for deste protocolo. */
export function parseWifiResponse(found: NativeWifiDevice): DeviceInfo | null {
  const response = found.response.trim();
  if (response === 'ILUMINUS_ACK') {
    return { id: `wifi:iluminus:${found.address}`, name: 'Iluminus', address: found.address, kind: 'wifi', wifiMode: 'http' };
  }
  if (!response.startsWith('UNWIRED_ACK')) return null;
  const fields = new Map(
    response
      .split(';')
      .slice(1)
      .map((field) => {
        const at = field.indexOf('=');
        return at < 0 ? [field, ''] : [field.slice(0, at), field.slice(at + 1)];
      }),
  );
  const tcp = validPort(fields.get('tcp'));
  const http = validPort(fields.get('http'));
  return {
    id: `wifi:${fields.get('id') || found.address}`,
    name: fields.get('name') || found.address,
    address: found.address,
    kind: 'wifi',
    wifiMode: tcp ? 'stream' : 'http',
    // No modo de comandos, a porta só é guardada quando foge da 80.
    port: tcp ?? (http && http !== HTTP_DEFAULT_PORT ? http : undefined),
  };
}

/**
 * Um dispositivo pode responder às duas mensagens de descoberta. Fica uma entrada por endereço,
 * e a resposta do protocolo unWired vence a do formato antigo, por trazer id, nome e portas.
 */
export function mergeWifiResponses(found: NativeWifiDevice[]): DeviceInfo[] {
  const byAddress = new Map<string, DeviceInfo>();
  for (const item of found) {
    const device = parseWifiResponse(item);
    if (!device) continue;
    const current = byAddress.get(device.address);
    const legacy = (info: DeviceInfo) => info.id.startsWith('wifi:iluminus:');
    if (!current || (legacy(current) && !legacy(device))) byAddress.set(device.address, device);
  }
  return [...byAddress.values()];
}

export interface WifiProbe {
  /** Respostas da descoberta na rede. */
  discover(): Promise<NativeWifiDevice[]>;
  /** Tenta abrir e fechar uma conexão com este dispositivo. */
  test(device: DeviceInfo): Promise<boolean>;
}

/**
 * Descobre sozinho como falar com um IP digitado à mão: primeiro pela resposta da descoberta,
 * depois tentando o fluxo TCP na porta indicada e, por fim, os comandos HTTP na porta 80.
 */
export async function identifyWifi(ip: string, tcpPort: number, probe: WifiProbe): Promise<DeviceInfo | null> {
  const announced = mergeWifiResponses(await probe.discover().catch(() => [])).find((device) => device.address === ip);
  if (announced) return announced;
  const base = { id: `wifi:manual:${ip}`, name: ip, address: ip, kind: 'wifi' as const };
  const stream: DeviceInfo = { ...base, wifiMode: 'stream', port: tcpPort };
  if (await probe.test(stream)) return stream;
  const http: DeviceInfo = { ...base, wifiMode: 'http' };
  if (await probe.test(http)) return http;
  return null;
}
