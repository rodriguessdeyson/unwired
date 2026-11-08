import { describe, expect, it } from 'vitest';
import { LineFramer, parseLine } from './parser';

describe('parseLine', () => {
  it('detecta nome e valor', () => {
    const result = parseLine('auto', 'T=23.41 H=60.90');
    expect(result.format).toBe('chaves');
    expect(result.values).toEqual([
      { key: 'T', value: 23.41 },
      { key: 'H', value: 60.9 },
    ]);
  });

  it('detecta valores separados e numera os canais', () => {
    const result = parseLine('auto', '12.1,3.3,512');
    expect(result.format).toBe('csv');
    expect(result.values.map((value) => value.key)).toEqual(['Canal 1', 'Canal 2', 'Canal 3']);
  });

  it('detecta JSON e ignora campos que não são números', () => {
    const result = parseLine('auto', '{"temp":23.4,"estado":"ok"}');
    expect(result.format).toBe('json');
    expect(result.values).toEqual([{ key: 'temp', value: 23.4 }]);
  });

  it('lê números de vetores e objetos aninhados no JSON', () => {
    const result = parseLine('auto', '{"seq":172347,"ondas":[0.12759,-0.99182],"sensor":{"temp":21.5,"nome":"a"}}');
    expect(result.format).toBe('json');
    expect(result.values).toEqual([
      { key: 'seq', value: 172347 },
      { key: 'ondas[0]', value: 0.12759 },
      { key: 'ondas[1]', value: -0.99182 },
      { key: 'sensor.temp', value: 21.5 },
    ]);
  });

  it('detecta XML com números dentro das tags', () => {
    const result = parseLine('auto', '<dados><temp>23.4</temp><umidade>60</umidade><estado>ok</estado></dados>');
    expect(result.format).toBe('xml');
    expect(result.values).toEqual([
      { key: 'temp', value: 23.4 },
      { key: 'umidade', value: 60 },
    ]);
  });

  it('detecta XML com números em atributos, sem contar a declaração', () => {
    const result = parseLine('auto', `<?xml version="1.0"?><leitura temp="-3.5" hum='61' sala="cozinha"/>`);
    expect(result.format).toBe('xml');
    expect(result.values).toEqual([
      { key: 'temp', value: -3.5 },
      { key: 'hum', value: 61 },
    ]);
  });

  it('XML de uma tag por linha também vira canal', () => {
    expect(parseLine('auto', '  <temp unidade="C">23.4</temp>').values).toEqual([{ key: 'temp', value: 23.4 }]);
  });

  it('XML sem números fica só no terminal', () => {
    expect(parseLine('auto', '<estado>ligado</estado>')).toEqual({ values: [], format: null });
    expect(parseLine('auto', '<dados>')).toEqual({ values: [], format: null });
  });

  it('detecta um número sozinho', () => {
    expect(parseLine('auto', '23.45').values).toEqual([{ key: 'Valor', value: 23.45 }]);
  });

  it('trata texto como texto', () => {
    expect(parseLine('auto', 'LED1 ligado')).toEqual({ values: [], format: null });
    expect(parseLine('auto', 'Erro 404')).toEqual({ values: [], format: null });
  });

  it('respeita o formato escolhido em vez de adivinhar', () => {
    expect(parseLine('csv', 'T=23.41').values).toEqual([]);
    expect(parseLine('numero', '1,2').values).toEqual([]);
  });

  it('lê 5 bytes no modo legado', () => {
    expect(parseLine('legado', '23.45XYZ').values).toEqual([{ key: 'Valor', value: 23.45 }]);
    expect(parseLine('legado', 'abcde').values).toEqual([]);
  });
});

describe('LineFramer', () => {
  it('junta pedaços e aceita qualquer terminador', () => {
    const framer = new LineFramer();
    expect(framer.push('T=1')).toEqual([]);
    expect(framer.push('.5\r\nH=2\n')).toEqual(['T=1.5', 'H=2']);
    expect(framer.push('A\rB\r')).toEqual(['A', 'B']);
  });

  it('entrega linha sem terminador no flush', () => {
    const framer = new LineFramer();
    framer.push('pronto');
    expect(framer.flush()).toEqual(['pronto']);
    expect(framer.flush()).toEqual([]);
  });

  it('não cresce sem limite sem terminador', () => {
    const framer = new LineFramer(false, 8);
    expect(framer.push('123456789')).toEqual(['123456789']);
  });

  it('corta mensagens de 5 bytes no modo legado', () => {
    const framer = new LineFramer(true);
    expect(framer.push('23.4523.')).toEqual(['23.45']);
    expect(framer.push('46')).toEqual(['23.46']);
  });
});
