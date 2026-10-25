import { decodeBase64Bytes } from './binary.util';
import {
  DecodedPointCloud,
  PointCloudMessage,
  PointFieldDataType,
} from '../models/point-cloud.model';
import { POINT_CLOUD_LIMITS } from '../constants/point-cloud.constants';

export function decodePointCloud(
  message: PointCloudMessage,
  maxPoints: number = POINT_CLOUD_LIMITS.maxRenderedPoints,
): DecodedPointCloud {
  const { width, height, point_step: step, row_step: rowStep } = message;
  if (
    ![width, height, step, rowStep, maxPoints].every(
      (value) => Number.isInteger(value) && value > 0,
    ) ||
    rowStep < width * step ||
    width * height > POINT_CLOUD_LIMITS.maxInputPoints ||
    rowStep * height > POINT_CLOUD_LIMITS.maxBytes
  )
    throw new Error('Invalid or oversized point cloud');
  const fields = ['x', 'y', 'z'].map((name) => {
    const field = message.fields?.find((field) => field.name === name);
    if (
      !field ||
      ![PointFieldDataType.Float32, PointFieldDataType.Float64].includes(field.datatype) ||
      !Number.isInteger(field.offset) ||
      field.offset < 0 ||
      field.count !== 1 ||
      field.offset + (field.datatype === PointFieldDataType.Float32 ? 4 : 8) > step
    )
      throw new Error(`Unsupported ${name} coordinate field`);
    return field;
  });
  let bytes: Uint8Array;
  if (typeof message.data === 'string') {
    if (message.data.length > POINT_CLOUD_LIMITS.maxEncodedCharacters)
      throw new Error('Encoded point cloud is too large');
    bytes = decodeBase64Bytes(message.data);
  } else {
    if (!Array.isArray(message.data) || message.data.length > POINT_CLOUD_LIMITS.maxBytes)
      throw new Error('Invalid point data');
    bytes = Uint8Array.from(message.data);
  }
  if (bytes.length < rowStep * height) throw new Error('Truncated point cloud');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const stride = Math.max(1, Math.ceil((width * height) / maxPoints));
  const result: number[] = [];
  for (let pointIndex = 0; pointIndex < width * height; pointIndex += stride) {
    const offset = Math.floor(pointIndex / width) * rowStep + (pointIndex % width) * step;
    const xyz = fields.map((field) =>
      field.datatype === PointFieldDataType.Float32
        ? view.getFloat32(offset + field.offset, !message.is_bigendian)
        : view.getFloat64(offset + field.offset, !message.is_bigendian),
    );
    if (xyz.every(Number.isFinite)) result.push(...xyz);
  }
  if (!result.length) throw new Error('Point cloud contains no finite points');
  return { positions: new Float32Array(result), frameId: message.header?.frame_id || '' };
}
