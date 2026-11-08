import { ApplicationConfig, inject, Injectable, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, RouteReuseStrategy, withPreloading, NoPreloading } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular';
import { provideTransloco, Translation, TranslocoLoader, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom, from, Observable } from 'rxjs';
import { routes } from './app.routes';
import { PremiumStore } from './core/premium.store';
import { SettingsStore } from './core/settings.store';

const LANGUAGES = ['pt', 'en', 'es'];

@Injectable({ providedIn: 'root' })
class BundledLoader implements TranslocoLoader {
  getTranslation(lang: string): Observable<Translation> {
    const load: Record<string, () => Promise<[{ default: Translation }, { default: Translation }]>> = {
      pt: () => Promise.all([import('./i18n/pt.json'), import('./i18n/guide.pt.json')]) as never,
      en: () => Promise.all([import('./i18n/en.json'), import('./i18n/guide.en.json')]) as never,
      es: () => Promise.all([import('./i18n/es.json'), import('./i18n/guide.es.json')]) as never,
    };
    return from((load[lang] ?? load['pt'])().then(([main, guide]) => ({ ...main.default, guide: guide.default })));
  }
}

export function resolveLanguage(saved: string, system: string): string {
  if (LANGUAGES.includes(saved)) return saved;
  const prefix = system.toLowerCase().slice(0, 2);
  return LANGUAGES.includes(prefix) ? prefix : 'en';
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideIonicAngular({ mode: 'md' }),
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideRouter(routes, withPreloading(NoPreloading)),
    provideTransloco({
      config: { availableLangs: LANGUAGES, defaultLang: 'pt', fallbackLang: 'pt', reRenderOnLangChange: true, prodMode: true },
      loader: BundledLoader,
    }),
    provideAppInitializer(async () => {
      const store = inject(SettingsStore);
      const transloco = inject(TranslocoService);
      const premium = inject(PremiumStore);
      await Promise.all([store.load(), premium.load()]);
      const lang = resolveLanguage(store.settings().lang, navigator.language);
      transloco.setActiveLang(lang);
      document.documentElement.lang = lang;
      await firstValueFrom(transloco.load(lang));
    }),
  ],
};
