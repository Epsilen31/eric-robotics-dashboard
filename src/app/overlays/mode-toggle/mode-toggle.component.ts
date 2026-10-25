import { Component, inject } from '@angular/core';
import { DashboardStateService } from '../../core/dashboard-state.service';

@Component({
  selector: 'app-mode-toggle',
  standalone: true,
  templateUrl: './mode-toggle.component.html',
  styleUrl: './mode-toggle.component.scss',
})
export class ModeToggleComponent {
  readonly state = inject(DashboardStateService);
}
