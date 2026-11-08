import { describe, expect, it } from 'vitest';
import { ChannelTracker } from './channel-tracker';

const reading = (key: string, value: number) => [{ key, value }];

describe('ChannelTracker', () => {
  it('só confirma um canal depois de algumas linhas', () => {
    const tracker = new ChannelTracker(3);
    tracker.add(reading('T', 1));
    tracker.add(reading('T', 2));
    expect(tracker.channels()).toEqual([]);
    tracker.add(reading('T', 3));
    expect(tracker.channels().map((channel) => channel.key)).toEqual(['T']);
    expect(tracker.channels()[0].last).toBe(3);
  });

  it('mensagem solta não vira canal', () => {
    const tracker = new ChannelTracker(3);
    tracker.add(reading('Status', 200));
    expect(tracker.channels()).toEqual([]);
    expect(tracker.xs).toEqual([]);
  });

  it('mantém as séries alinhadas quando um canal para', () => {
    const tracker = new ChannelTracker(1);
    tracker.add([
      { key: 'T', value: 1 },
      { key: 'H', value: 2 },
    ]);
    tracker.add(reading('T', 3));
    const [t, h] = tracker.channels();
    expect(t.values).toEqual([1, 3]);
    expect(h.values).toEqual([2, null]);
    expect(h.last).toBe(2);
  });

  it('preenche o início de um canal que chega depois', () => {
    const tracker = new ChannelTracker(1);
    tracker.add(reading('T', 1));
    tracker.add(reading('H', 2));
    expect(tracker.channels()[1].values).toEqual([null, 2]);
  });

  it('canais do perfil salvo existem antes dos dados', () => {
    const tracker = new ChannelTracker(3);
    tracker.seed(['T']);
    expect(tracker.channels()[0].last).toBeNull();
    tracker.add(reading('T', 5));
    expect(tracker.channels()[0].last).toBe(5);
  });

  it('limita canais e amostras', () => {
    const tracker = new ChannelTracker(1, 1, 2);
    tracker.add(reading('A', 1));
    tracker.add(reading('B', 1));
    expect(tracker.channels().map((channel) => channel.key)).toEqual(['A']);
    tracker.add(reading('A', 2));
    tracker.add(reading('A', 3));
    expect(tracker.channels()[0].values).toEqual([2, 3]);
    expect(tracker.xs.length).toBe(2);
  });
});
