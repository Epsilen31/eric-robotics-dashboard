import { DASHBOARD_SETTINGS } from '../../core/constants/dashboard.constants';
import { DRIVE_DIRECTIONS } from './drive-controls.constants';
import type { DriveDirection } from './drive-controls.model';
import { Component, HostListener, effect, inject, signal } from '@angular/core';
import { DashboardStateService } from '../../core/dashboard-state.service';

@Component({
  selector: 'app-drive-controls',
  standalone: true,
  templateUrl: './drive-controls.component.html',
  styleUrl: './drive-controls.component.scss',
})
export class DriveControlsComponent {
  readonly state = inject(DashboardStateService);
  readonly enabled = this.state.manualEnabled;
  readonly directions = DRIVE_DIRECTIONS;
  readonly settings = DASHBOARD_SETTINGS;
  private readonly keys = signal<ReadonlySet<string>>(new Set());
  private readonly pointers = signal<ReadonlyMap<number, DriveDirection>>(new Map());

  constructor() {
    effect(() => {
      this.state.ros.status();
      if (!this.enabled()) this.clear();
    });
    effect(() => {
      this.state.setDrive(
        (Number(this.pressed('w')) - Number(this.pressed('s'))) *
          DASHBOARD_SETTINGS.manualLinearSpeed,
        (Number(this.pressed('a')) - Number(this.pressed('d'))) *
          DASHBOARD_SETTINGS.manualAngularSpeed,
      );
    });
  }

  updateZoom(event: Event): void {
    if (event.target instanceof HTMLInputElement) this.state.setZoom(Number(event.target.value));
  }

  pressed(direction: DriveDirection): boolean {
    return (
      this.enabled() &&
      (this.keys().has(direction) || [...this.pointers().values()].includes(direction))
    );
  }

  @HostListener('window:keydown', ['$event'])
  keydown(event: KeyboardEvent): void {
    const key = event.key.toLowerCase();
    const target = event.target;
    if (
      !this.enabled() ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      (target instanceof HTMLElement &&
        target.closest('input, textarea, select, [contenteditable]')) ||
      !this.directions.some((direction) => direction.key === key)
    )
      return;
    event.preventDefault();
    this.keys.update((keys) => new Set([...keys, key]));
  }

  @HostListener('window:keyup', ['$event'])
  keyup(event: KeyboardEvent): void {
    this.keys.update((keys) => {
      const next = new Set(keys);
      next.delete(event.key.toLowerCase());
      return next;
    });
  }

  press(event: PointerEvent, direction: DriveDirection): void {
    if (!this.enabled() || event.button !== 0) return;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    this.pointers.update((pointers) => new Map(pointers).set(event.pointerId, direction));
  }

  release(event: PointerEvent): void {
    this.pointers.update((pointers) => {
      const next = new Map(pointers);
      next.delete(event.pointerId);
      return next;
    });
  }

  @HostListener('window:blur')
  @HostListener('document:visibilitychange')
  clear(): void {
    this.keys.set(new Set());
    this.pointers.set(new Map());
  }
}
