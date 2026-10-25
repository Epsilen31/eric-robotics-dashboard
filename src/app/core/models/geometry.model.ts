export interface Position2D {
  x: number;
  y: number;
}
export interface RobotPose2D extends Position2D {
  heading: number;
}
export interface RobotPose extends RobotPose2D {
  z: number;
  frameId: string;
}
