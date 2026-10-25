export enum SidebarAction {
  Camera = 'camera',
  FloorPlan = 'floor-plan',
  SelectGoal = 'select-goal',
  PointCloud = 'point-cloud',
  Recenter = 'recenter',
  Settings = 'settings',
}
export interface SidebarItem {
  action: SidebarAction;
  label: string;
  path: string;
}
