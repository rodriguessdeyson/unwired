import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { startIntro } from './intro';

const finishIntro = startIntro();

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err))
  .finally(finishIntro);
