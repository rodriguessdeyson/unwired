import { Component, ElementRef, HostListener, inject, viewChild } from '@angular/core';
import { IonIcon, IonLabel, IonTabBar, IonTabButton, IonTabs, ViewDidEnter, ViewWillLeave } from '@ionic/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { AdsService } from '../core/monetization/ads.service';
import { PaywallComponent } from '../features/premium/paywall.component';

/** Abas que aceitam banner. A Sessão fica livre: lá o toque acidental seria fácil. */
const BANNER_TABS = new Set(['dispositivos', 'ajustes']);

@Component({
  selector: 'app-tabs',
  imports: [IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel, PaywallComponent, TranslocoPipe],
  template: `
    <ion-tabs (ionTabsDidChange)="onTab($event.tab)">
      <!-- Espaço do banner nativo, que é desenhado por cima do WebView. -->
      <div aria-hidden="true" class="shrink-0 bg-ink-900" [style.height.px]="ads.bannerSpace()"></div>
      <ion-tab-bar #bar slot="bottom">
        <ion-tab-button tab="dispositivos">
          <ion-icon name="hardware-chip-outline" aria-hidden="true" />
          <ion-label>{{ 'tabs.devices' | transloco }}</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="sessao">
          <ion-icon name="pulse-outline" aria-hidden="true" />
          <ion-label>{{ 'tabs.session' | transloco }}</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="ajustes">
          <ion-icon name="options-outline" aria-hidden="true" />
          <ion-label>{{ 'tabs.settings' | transloco }}</ion-label>
        </ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>
    <app-paywall />
  `,
})
export class TabsPage implements ViewDidEnter, ViewWillLeave {
  protected readonly ads = inject(AdsService);
  private readonly bar = viewChild.required('bar', { read: ElementRef<HTMLElement> });
  private tab = '';
  private visible = false;

  protected onTab(tab: string): void {
    this.tab = tab;
    this.update();
  }

  ionViewDidEnter(): void {
    this.visible = true;
    void this.ads.start();
    this.update();
  }

  /** Busca, Guia e outras telas fora das abas não mostram o banner. */
  ionViewWillLeave(): void {
    this.visible = false;
    this.update();
  }

  @HostListener('window:resize')
  protected update(): void {
    const top = this.bar().nativeElement.getBoundingClientRect().top;
    this.ads.setBannerSlot(this.visible && BANNER_TABS.has(this.tab), window.innerHeight - top);
  }
}
