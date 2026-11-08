import { Capacitor } from '@capacitor/core';
import { UnwiredSerial } from './native-serial';

let wanted = false;
let lock: WakeLockSentinel | null = null;

async function requestWebLock(): Promise<void> {
  if (!wanted || lock || document.visibilityState !== 'visible' || !('wakeLock' in navigator)) return;
  try {
    lock = await navigator.wakeLock.request('screen');
    lock.addEventListener('release', () => (lock = null));
  } catch {
    // Sem suporte ou sem permissão: a tela segue o tempo normal do aparelho.
  }
}

// O navegador solta a trava quando a aba some; ao voltar, pede de novo.
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => void requestWebLock());

/** Mantém a tela acesa enquanto `enabled` for verdadeiro. */
export async function keepScreenOn(enabled: boolean): Promise<void> {
  if (enabled === wanted) return;
  wanted = enabled;
  if (Capacitor.isNativePlatform()) {
    await UnwiredSerial.keepScreenOn({ enabled }).catch(() => undefined);
    return;
  }
  if (enabled) await requestWebLock();
  else {
    await lock?.release().catch(() => undefined);
    lock = null;
  }
}
