import { describe, expect, it } from 'vitest';
import { mapLegacyPreferences } from './settings.store';

describe('mapLegacyPreferences', () => {
  it('leva os ajustes do app antigo', () => {
    expect(
      mapLegacyPreferences({ prefComL: 'ON', prefComD: 'OFF', prefBuffer: '5000', prefX: '200', prefYmin: '-5', prefYmax: '50' }),
    ).toEqual({ startCommand: 'ON', stopCommand: 'OFF', historyChars: 5000, windowSize: 200, yMin: -5, yMax: 50 });
  });

  it('ignora valores inválidos e os que não existem mais', () => {
    expect(
      mapLegacyPreferences({ prefBuffer: 'abc', prefX: '1', prefYmin: '10', prefYmax: '5', prefTheme: '3', prefColor: '2' }),
    ).toEqual({});
  });
});
