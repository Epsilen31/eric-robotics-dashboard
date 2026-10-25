import { inject, provideAppInitializer } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { RosService } from './app/core/ros.service';
bootstrapApplication(AppComponent, {
  providers: [provideAppInitializer(() => inject(RosService).initialize())],
}).catch(console.error);
