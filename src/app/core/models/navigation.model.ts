import type { Position2D } from './geometry.model';
export type DashboardView = 'map' | 'camera';
export type MapMode = 'floor' | 'scan';
export type OperatingMode = 'auto' | 'manual';
export type MissionStatus =
  'idle' | 'ready' | 'running' | 'submitted' | 'paused' | 'completed' | 'stopped' | 'interrupted';
export interface NavigationGoal extends Position2D {
  z: number;
  source: 'demo' | 'ros';
  frameId: string;
}
export interface DriveCommand {
  linear: number;
  angular: number;
}
