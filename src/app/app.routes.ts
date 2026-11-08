import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { SettingsStore } from './core/settings/settings.store';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: () => (inject(SettingsStore).settings().onboarded ? 'tabs/dispositivos' : 'onboarding'),
  },
  { path: 'onboarding', loadComponent: () => import('./features/onboarding/onboarding.page').then((m) => m.OnboardingPage) },
  { path: 'busca', loadComponent: () => import('./features/devices/scan.page').then((m) => m.ScanPage) },
  { path: 'wifi', loadComponent: () => import('./features/devices/wifi.page').then((m) => m.WifiPage) },
  { path: 'formato', loadComponent: () => import('./features/session/format.page').then((m) => m.FormatPage) },
  { path: 'guia', loadComponent: () => import('./features/guide/guide.page').then((m) => m.GuidePage) },
  {
    path: 'tabs',
    loadComponent: () => import('./layout/tabs.page').then((m) => m.TabsPage),
    children: [
      { path: 'dispositivos', loadComponent: () => import('./features/devices/devices.page').then((m) => m.DevicesPage) },
      { path: 'sessao', loadComponent: () => import('./features/session/session.page').then((m) => m.SessionPage) },
      { path: 'ajustes', loadComponent: () => import('./features/settings/settings.page').then((m) => m.SettingsPage) },
      { path: '', pathMatch: 'full', redirectTo: 'dispositivos' },
    ],
  },
];
