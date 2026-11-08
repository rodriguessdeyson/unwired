import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rad.unwired',
  appName: 'unWired',
  webDir: 'dist/unwired-app/browser',
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      // src/intro.ts esconde esta tela assim que o WebView abre e continua com a
      // abertura animada, sem transição. Os 4 s são só o limite, caso o app trave.
      launchAutoHide: true,
      launchShowDuration: 4000,
      launchFadeOutDuration: 0,
      backgroundColor: '#121018',
    },
    SystemBars: {
      // O app é sempre escuro: ícones claros na barra do sistema.
      style: 'DARK',
    },
  },
};

export default config;
