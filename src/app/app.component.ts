import { SidebarComponent } from './layout/sidebar/sidebar.component';
import { ConnectionPanelComponent } from './overlays/connection-panel/connection-panel.component';
import { Component, inject } from '@angular/core';
import { DashboardStateService } from './core/dashboard-state.service';
import { StatusPillComponent } from './overlays/status-pill/status-pill.component';
import { StatusBarComponent } from './overlays/status-bar/status-bar.component';
import { ModeToggleComponent } from './overlays/mode-toggle/mode-toggle.component';
import { ActionButtonComponent } from './overlays/action-button/action-button.component';
import { CameraViewComponent } from './views/camera-view/camera-view.component';
import { MapViewComponent } from './views/map-view/map-view.component';
import { DriveControlsComponent } from './overlays/drive-controls/drive-controls.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    SidebarComponent,
    ConnectionPanelComponent,
    StatusPillComponent,
    StatusBarComponent,
    ModeToggleComponent,
    ActionButtonComponent,
    CameraViewComponent,
    MapViewComponent,
    DriveControlsComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  readonly state = inject(DashboardStateService);
}
