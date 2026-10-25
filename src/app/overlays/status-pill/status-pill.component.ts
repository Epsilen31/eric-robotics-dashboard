import { Component, inject } from '@angular/core';
import { DashboardStateService } from '../../core/dashboard-state.service';

@Component({
  selector: 'app-status-pill',
  standalone: true,
  templateUrl: './status-pill.component.html',
  styleUrl: './status-pill.component.scss',
})
export class StatusPillComponent {
  readonly state = inject(DashboardStateService);
}
