import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rad.unwired',
  appName: 'unWired',
  webDir: 'dist/unwired-app/browser',
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SystemBars: {
      // O app é sempre escuro: ícones claros na barra do sistema.
      style: 'DARK',
    },
  },
};

export default config;
