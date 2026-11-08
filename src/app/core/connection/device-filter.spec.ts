import { describe, expect, it } from 'vitest';
import { isLikelyIot } from './device-filter';

describe('isLikelyIot', () => {
  it('mostra módulos seriais e placas pelo nome', () => {
    for (const name of ['HC-05', 'HC-06 Silencioso', 'HM-10 Estufa', 'JDY-31-SPP', 'ESP32 Sensor', 'MeuESP32', 'Arduino Nano', 'BT05']) {
      expect(isLikelyIot({ name, kind: 'spp' }), name).toBe(true);
    }
  });

  it('mostra o ESP32 serial mesmo anunciado como computador', () => {
    expect(isLikelyIot({ name: 'Estufa', kind: 'spp', major: 0x0100 })).toBe(true);
  });

  it('esconde TVs, caixas de som, celulares e ar-condicionado', () => {
    expect(isLikelyIot({ name: '[TV] Samsung 7 Series', kind: 'spp', major: 0x0400 })).toBe(false);
    expect(isLikelyIot({ name: 'JBL Flip 5', kind: 'spp' })).toBe(false);
    expect(isLikelyIot({ name: 'Moto G', kind: 'spp', major: 0x0200 })).toBe(false);
    expect(isLikelyIot({ name: '[AC] Sala', kind: 'ble' })).toBe(false);
    expect(isLikelyIot({ name: 'Ar-condicionado quarto', kind: 'ble' })).toBe(false);
    expect(isLikelyIot({ name: 'Galaxy Buds2', kind: 'ble', companies: [0x0075] })).toBe(false);
  });

  it('o serviço UART ou o fabricante do chip vencem o resto', () => {
    expect(isLikelyIot({ name: 'Speaker lab', kind: 'ble', uuids: ['6E400001-B5A3-F393-E0A9-E50E24DCCA9E'] })).toBe(true);
    expect(isLikelyIot({ name: 'Caixa de som', kind: 'ble', companies: [0x02e5] })).toBe(true);
  });

  it('na dúvida, mostra', () => {
    expect(isLikelyIot({ name: 'Sensor da garagem', kind: 'ble' })).toBe(true);
    expect(isLikelyIot({ name: 'Bancada', kind: 'spp', major: 0x1f00 })).toBe(true);
    expect(isLikelyIot({ name: 'Qualquer', kind: 'wifi' })).toBe(true);
  });
});
