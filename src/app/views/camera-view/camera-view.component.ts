import { Component, ElementRef, effect, inject, viewChild } from '@angular/core';
import { RosService } from '../../core/ros.service';
import { DashboardStateService } from '../../core/dashboard-state.service';
import { renderDemoCamera } from '../../core/demo/demo-camera';

@Component({
  selector: 'app-camera-view',
  standalone: true,
  templateUrl: './camera-view.component.html',
  styleUrl: './camera-view.component.scss',
})
export class CameraViewComponent {
  readonly ros = inject(RosService);
  private readonly state = inject(DashboardStateService);
  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('demoCamera');
  constructor() {
    effect(() => {
      const canvas = this.canvas()?.nativeElement;
      if (canvas && this.ros.status() === 'demo') renderDemoCamera(canvas, this.state.robot());
    });
  }
}
