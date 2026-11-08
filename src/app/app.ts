import { Component, inject } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  chevronBackOutline,
  chevronForwardOutline,
  bluetooth,
  createOutline,
  ellipsisVertical,
  hardwareChipOutline,
  optionsOutline,
  pause,
  phoneLandscapeOutline,
  play,
  pulseOutline,
  reorderTwoOutline,
  searchOutline,
  terminalOutline,
  trashOutline,
  wifi,
} from 'ionicons/icons';

import { ViewportService } from './core/viewport.service';

@Component({
  selector: 'app-root',
  imports: [IonApp, IonRouterOutlet],
  template: `<ion-app><ion-router-outlet /></ion-app>`,
})
export class App {
  constructor() {
    inject(ViewportService);
    addIcons({
      bluetooth,
      chevronBackOutline,
      chevronForwardOutline,
      createOutline,
      ellipsisVertical,
      hardwareChipOutline,
      optionsOutline,
      pause,
      phoneLandscapeOutline,
      play,
      pulseOutline,
      reorderTwoOutline,
      searchOutline,
      terminalOutline,
      trashOutline,
      wifi,
    });
  }
}
