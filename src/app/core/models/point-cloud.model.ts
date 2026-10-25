export interface PointCloudMessage {
  header: { frame_id: string };
  width: number;
  height: number;
  point_step: number;
  row_step: number;
  is_bigendian: boolean;
  fields: { name: string; offset: number; datatype: number; count: number }[];
  data: string | number[];
}
export interface DecodedPointCloud {
  positions: Float32Array;
  frameId: string;
}
export enum PointFieldDataType {
  Float32 = 7,
  Float64 = 8,
}
