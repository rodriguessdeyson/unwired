import { afterNextRender, Component, DestroyRef, effect, ElementRef, inject, input, untracked, viewChild } from '@angular/core';
import uPlot from 'uplot';
import { chartWindow, stableRange } from '../../core/data/chart-math';
import { SessionStore } from '../../core/session/session.store';

@Component({
  selector: 'app-live-chart',
  host: { class: 'block size-full' },
  template: `<div #host class="size-full"></div>`,
})
export class LiveChartComponent {
  private readonly session = inject(SessionStore);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = viewChild.required<ElementRef<HTMLElement>>('host');

  /** Mostra só este canal, com a escala Y dele. */
  readonly only = input<string | null>(null);
  readonly muted = input<ReadonlySet<string>>(new Set());
  readonly windowSize = input(120);
  readonly locked = input(false);
  readonly lockStart = input(0);
  readonly follow = input(true);
  readonly frozen = input(0);
  readonly yMin = input<number | null>(null);
  readonly yMax = input<number | null>(null);
  readonly compact = input(false);

  private plot: uPlot | null = null;
  private signature = '';
  private keys: string[] = [];
  private ready = false;
  private yRange: [number, number] | null = null;

  constructor() {
    afterNextRender(() => {
      this.ready = true;
      const element = this.host().nativeElement;
      const observer = new ResizeObserver(() => {
        // Durante a transição o tamanho muda a cada quadro; o traço acompanha.
        const { clientWidth: width, clientHeight: height } = element;
        if (this.plot && width && height) this.plot.setSize({ width, height });
        else if (!this.plot && width && height) this.draw();
      });
      observer.observe(element);
      this.destroyRef.onDestroy(() => {
        observer.disconnect();
        this.plot?.destroy();
      });
      this.draw();
    });

    effect(() => {
      this.session.tick();
      this.session.channels();
      this.only();
      this.muted();
      this.windowSize();
      this.locked();
      this.lockStart();
      this.follow();
      this.frozen();
      this.yMin();
      this.yMax();
      this.compact();
      untracked(() => this.draw());
    });
  }

  canvas(): HTMLCanvasElement | null {
    return this.plot?.ctx.canvas ?? null;
  }

  private draw(): void {
    if (!this.ready) return;
    const element = this.host().nativeElement;
    if (!element.clientWidth || !element.clientHeight) return;

    const series = this.session.visibleChannels().filter((channel) => (this.only() ? channel.key === this.only() : !this.muted().has(channel.key)));
    const keys = series.map((channel) => channel.key);
    const signature = [series.map((channel) => `${channel.key}:${channel.color}`).join('|'), this.compact(), this.yMin(), this.yMax()].join('#');
    if (signature !== this.signature || !this.plot) {
      this.plot?.destroy();
      // Mudar só a altura do gráfico mantém a escala; mudar os canais recomeça.
      if (keys.join('|') !== this.keys.join('|')) this.yRange = null;
      this.signature = signature;
      this.keys = keys;
      this.plot = this.createPlot(element, series.map((channel) => channel.color));
    }

    const tracker = this.session.tracker();
    const range = chartWindow(tracker.xs, this.windowSize(), {
      locked: this.locked(),
      lockStart: this.lockStart(),
      follow: this.follow(),
      frozen: this.frozen(),
    });
    const byKey = new Map(tracker.channels().map((channel) => [channel.key, channel]));
    const data: uPlot.AlignedData = [
      tracker.xs.slice(range.from, range.to),
      ...this.keys.map((key) => (byKey.get(key)?.values ?? []).slice(range.from, range.to)),
    ];
    this.plot.setData(data, true);
    this.plot.setScale('x', { min: range.min, max: range.max });
  }

  private createPlot(element: HTMLElement, colors: string[]): uPlot {
    const axisFont = '11px "IBM Plex Mono", monospace';
    const min = this.yMin();
    const max = this.yMax();
    const compact = this.compact();
    return new uPlot(
      {
        width: element.clientWidth,
        height: element.clientHeight,
        legend: { show: false },
        cursor: { show: false },
        padding: compact ? [6, 6, 6, 6] : [10, 10, 6, 0],
        scales: {
          x: { time: false },
          y:
            min !== null && max !== null
              ? { range: [min, max] }
              : { range: (_plot, dataMin, dataMax) => (this.yRange = stableRange(dataMin, dataMax, this.yRange)) },
        },
        axes: [
          { show: false },
          {
            show: !compact,
            stroke: '#A8A2B8',
            font: axisFont,
            size: 44,
            grid: { stroke: '#262230', width: 1 },
            ticks: { show: false },
          },
        ],
        series: [{}, ...colors.map((stroke) => ({ stroke, width: 2, spanGaps: true, points: { show: false } }))],
      },
      [[], ...colors.map(() => [])],
      element,
    );
  }
}
