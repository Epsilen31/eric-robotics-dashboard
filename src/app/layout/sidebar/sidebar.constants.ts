import { SidebarAction, SidebarItem } from './sidebar.model';
export const SIDEBAR_ITEMS: readonly SidebarItem[] = [
  {
    action: SidebarAction.Camera,
    label: 'Dashboard · Camera View',
    path: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  },
  {
    action: SidebarAction.FloorPlan,
    label: 'Map View',
    path: 'm3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2z M9 3v16 M15 5v16',
  },
  {
    action: SidebarAction.SelectGoal,
    label: 'Quick goal',
    path: 'M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  },
  {
    action: SidebarAction.PointCloud,
    label: '3D Map View',
    path: 'M6 4h12 M20 6v12 M18 20H6 M4 18V6 M6 4a2 2 0 1 1-4 0 2 2 0 0 1 4 0 M22 4a2 2 0 1 1-4 0 2 2 0 0 1 4 0 M22 20a2 2 0 1 1-4 0 2 2 0 0 1 4 0 M6 20a2 2 0 1 1-4 0 2 2 0 0 1 4 0',
  },
  {
    action: SidebarAction.Recenter,
    label: 'Recenter map',
    path: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M12 3v3 M21 12h-3 M12 21v-3 M3 12h3',
  },
  {
    action: SidebarAction.Settings,
    label: 'System and ROS settings',
    path: 'M3 19 9 12 14 15 21 6 M3 19v-3 M21 6h-3',
  },
];
