import { Component, inject } from '@angular/core';
import { DashboardStateService } from '../../core/dashboard-state.service';

@Component({
  selector: 'app-status-bar',
  standalone: true,
  templateUrl: './status-bar.component.html',
  styleUrl: './status-bar.component.scss',
})
export class StatusBarComponent {
  readonly state = inject(DashboardStateService);
}
