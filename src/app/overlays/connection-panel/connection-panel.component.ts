import { ROS_TOPIC_FIELDS } from '../../core/constants/ros.constants';
import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, inject } from '@angular/core';
import { DashboardStateService } from '../../core/dashboard-state.service';
import type { RosConfig } from '../../core/models/ros.model';
@Component({
  selector: 'app-connection-panel',
  standalone: true,
  templateUrl: './connection-panel.component.html',
  styleUrl: './connection-panel.component.scss',
})
export class ConnectionPanelComponent implements AfterViewInit, OnDestroy {
  readonly state = inject(DashboardStateService);
  readonly ros = this.state.ros;
  draft: RosConfig = { ...this.ros.config() };
  @ViewChild('panel', { static: true }) panel!: ElementRef<HTMLDialogElement>;
  readonly topics = ROS_TOPIC_FIELDS;
  updateConfigField(field: keyof RosConfig, event: Event): void {
    if (event.target instanceof HTMLInputElement) this.draft[field] = event.target.value;
  }
  ngAfterViewInit(): void {
    this.panel.nativeElement.showModal();
  }
  close(): void {
    this.state.connectionPanel.set(false);
  }
  connect(event?: Event): void {
    event?.preventDefault();
    this.ros.connect(this.draft);
    if (this.ros.status() !== 'demo') this.close();
  }
  demo(): void {
    this.ros.useOfflineDemo();
    this.close();
    this.state.notify('Offline demo selected.');
  }
  backdrop(event: MouseEvent): void {
    if (event.target !== this.panel.nativeElement) return;
    const rect = this.panel.nativeElement.getBoundingClientRect();
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    )
      this.close();
  }
  ngOnDestroy(): void {
    this.panel.nativeElement.close();
  }
}
