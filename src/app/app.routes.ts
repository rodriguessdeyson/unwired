import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { SettingsStore } from './core/settings.store';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: () => (inject(SettingsStore).settings().onboarded ? 'tabs/dispositivos' : 'onboarding'),
  },
  { path: 'onboarding', loadComponent: () => import('./pages/onboarding.page').then((m) => m.OnboardingPage) },
  { path: 'busca', loadComponent: () => import('./pages/scan.page').then((m) => m.ScanPage) },
  { path: 'wifi', loadComponent: () => import('./pages/wifi.page').then((m) => m.WifiPage) },
  { path: 'formato', loadComponent: () => import('./pages/format.page').then((m) => m.FormatPage) },
  { path: 'guia', loadComponent: () => import('./pages/guide.page').then((m) => m.GuidePage) },
  {
    path: 'tabs',
    loadComponent: () => import('./pages/tabs.page').then((m) => m.TabsPage),
    children: [
      { path: 'dispositivos', loadComponent: () => import('./pages/devices.page').then((m) => m.DevicesPage) },
      { path: 'sessao', loadComponent: () => import('./pages/session.page').then((m) => m.SessionPage) },
      { path: 'ajustes', loadComponent: () => import('./pages/settings.page').then((m) => m.SettingsPage) },
      { path: '', pathMatch: 'full', redirectTo: 'dispositivos' },
    ],
  },
];
