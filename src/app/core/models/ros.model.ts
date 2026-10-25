export interface RosConfig {
  bridgeUrl: string;
  frameId: string;
  pointsTopic: string;
  cameraTopic: string;
  odometryTopic: string;
  batteryTopic: string;
  velocityTopic: string;
  goalTopic: string;
  stopTopic: string;
  pauseTopic: string;
  missionTopic: string;
}
export type RosConnectionStatus = 'demo' | 'connecting' | 'connected' | 'disconnected';
export interface RosPacket {
  op?: string;
  level?: string;
  topic?: string;
  msg?: unknown;
}
export interface OdometryMessage {
  header?: { frame_id?: string };
  pose?: {
    pose?: {
      position?: { x: number; y: number; z: number };
      orientation?: { x: number; y: number; z: number; w: number };
    };
  };
}
export interface CameraMessage {
  format: string;
  data: string | number[];
}
