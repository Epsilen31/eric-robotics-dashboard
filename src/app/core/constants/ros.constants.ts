import type { RosConfig } from '../models/ros.model';
export const DEFAULT_ROS_CONFIG: RosConfig = {
  bridgeUrl: 'ws://localhost:9090',
  frameId: 'map',
  pointsTopic: '/points',
  cameraTopic: '/camera/image/compressed',
  odometryTopic: '/odom',
  batteryTopic: '/battery_state',
  velocityTopic: '/cmd_vel',
  goalTopic: '/goal_pose',
  stopTopic: '/dashboard/stop',
  pauseTopic: '/dashboard/pause',
  missionTopic: '/dashboard/mission_status',
};
export const ROS_LIMITS = {
  reconnectDelayMs: 3000,
  maxPacketCharacters: 90000000,
  maxCameraCharacters: 12000000,
  cloudThrottleMs: 500,
  telemetryThrottleMs: 100,
} as const;

export const ROS_TOPIC_FIELDS: { key: keyof RosConfig; label: string }[] = [
  { key: 'pointsTopic', label: '3D point cloud' },
  { key: 'cameraTopic', label: 'Compressed camera' },
  { key: 'odometryTopic', label: 'Robot pose' },
  { key: 'batteryTopic', label: 'Battery' },
  { key: 'velocityTopic', label: 'Velocity commands' },
  { key: 'goalTopic', label: 'Navigation goals' },
  { key: 'stopTopic', label: 'Software stop' },
  { key: 'pauseTopic', label: 'Mission pause' },
  { key: 'missionTopic', label: 'Mission feedback' },
];
