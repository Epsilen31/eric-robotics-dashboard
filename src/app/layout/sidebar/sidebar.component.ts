import { Component, inject } from '@angular/core';
import { SIDEBAR_ITEMS } from './sidebar.constants';
import { SidebarAction } from './sidebar.model';
import { DashboardStateService } from '../../core/dashboard-state.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent {
  readonly state = inject(DashboardStateService);
  readonly items = SIDEBAR_ITEMS;
  readonly actions = SidebarAction;
  isSelected(action: SidebarAction): boolean {
    if (action === SidebarAction.Settings) return this.state.connectionPanel();
    if (this.state.connectionPanel()) return false;
    if (action === SidebarAction.Camera) return this.state.activeView() === 'camera';
    if (action === SidebarAction.SelectGoal) return this.state.selectingGoal();
    if (this.state.selectingGoal()) return false;
    return (
      this.state.activeView() === 'map' &&
      ((action === SidebarAction.FloorPlan && this.state.mapMode() === 'floor') ||
        (action === SidebarAction.PointCloud && this.state.mapMode() === 'scan'))
    );
  }
  select(action: SidebarAction): void {
    if ([SidebarAction.Camera, SidebarAction.FloorPlan, SidebarAction.PointCloud].includes(action))
      this.state.selectingGoal.set(false);
    if (action === SidebarAction.Camera) this.state.activeView.set('camera');
    else if (action === SidebarAction.FloorPlan) this.state.showFloorPlan();
    else if (action === SidebarAction.SelectGoal) this.state.startGoalSelection();
    else if (action === SidebarAction.PointCloud) this.state.showPointCloudMap();
    else if (action === SidebarAction.Recenter) {
      this.state.activeView.set('map');
      this.state.resetRevision.update((value) => value + 1);
    } else this.state.connectionPanel.set(true);
  }
}
