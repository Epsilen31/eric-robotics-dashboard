import type { DriveDirection } from './drive-controls.model';
export const DRIVE_DIRECTIONS: { key: DriveDirection; label: string; arrow: string }[] = [
  { key: 'w', label: 'Forward (W)', arrow: '↑' },
  { key: 'a', label: 'Left (A)', arrow: '←' },
  { key: 's', label: 'Backward (S)', arrow: '↓' },
  { key: 'd', label: 'Right (D)', arrow: '→' },
];
