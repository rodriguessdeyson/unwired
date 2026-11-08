import { inject, Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { toBase64, UnwiredSerial } from './native-serial';
import { SessionStore } from './session.store';

const stamp = (): string => new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');

export function buildCsv(xs: number[], channels: { name: string; values: (number | null)[] }[]): string {
  const escape = (text: string) => `"${text.replace(/"/g, '""')}"`;
  const header = ['amostra', ...channels.map((channel) => escape(channel.name))].join(',');
  const rows = xs.map((x, row) => [x, ...channels.map((channel) => channel.values[row] ?? '')].join(','));
  return [header, ...rows].join('\n');
}

@Injectable({ providedIn: 'root' })
export class ExportService {
  private readonly session = inject(SessionStore);

  async exportCsv(): Promise<void> {
    const views = new Map(this.session.channels().map((view) => [view.key, view.name]));
    const tracker = this.session.tracker();
    const csv = buildCsv(
      tracker.xs,
      tracker.channels().map((channel) => ({ name: views.get(channel.key) ?? channel.key, values: channel.values })),
    );
    await this.shareText(`unwired-${stamp()}.csv`, csv, 'text/csv');
  }

  async exportLog(): Promise<void> {
    const text = this.session
      .log()
      .map((line) => `${line.time} ${line.dir.toUpperCase()} ${line.text}`)
      .join('\n');
    await this.shareText(`unwired-${stamp()}.txt`, text, 'text/plain');
  }

  async exportImage(canvas: HTMLCanvasElement): Promise<void> {
    const dataUrl = canvas.toDataURL('image/png');
    const name = `unwired-${stamp()}.png`;
    if (!Capacitor.isNativePlatform()) {
      this.download(dataUrl, name);
      return;
    }
    const { uri } = await UnwiredSerial.writeCacheFile({ name, data: dataUrl.split(',')[1] });
    await Share.share({ files: [uri] });
  }

  private async shareText(name: string, text: string, type: string): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      const url = URL.createObjectURL(new Blob([text], { type }));
      this.download(url, name);
      URL.revokeObjectURL(url);
      return;
    }
    const { uri } = await UnwiredSerial.writeCacheFile({ name, data: toBase64(text) });
    await Share.share({ files: [uri] });
  }

  private download(url: string, name: string): void {
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
  }
}
