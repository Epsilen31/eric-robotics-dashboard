import type { MissionStatus } from '../models/navigation.model';
export const MISSION_LABELS: Readonly<Record<MissionStatus, string>> = {
  idle: 'Ready',
  ready: 'Goal selected',
  running: 'On Mission 1234',
  submitted: 'Goal sent',
  paused: 'Paused',
  completed: 'Mission complete',
  stopped: 'Stopped',
  interrupted: 'Disconnected',
};
export const DASHBOARD_SETTINGS = {
  movementIntervalMs: 100,
  noticeDurationMs: 4500,
  liveCloudMaxAgeMs: 10000,
  minZoom: 0.5,
  maxZoom: 4,
  zoomButtonStep: 0.1,
  zoomSliderStep: 0.05,
  manualLinearSpeed: 0.2,
  manualAngularSpeed: 0.6,
  manualDistanceScale: 18,
  missionStepDistance: 4,
  waypointTolerance: 5,
} as const;
