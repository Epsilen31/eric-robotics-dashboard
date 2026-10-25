const zlib = require('node:zlib');

const CAMERA = { width: 640, height: 360, horizon: 180, focalLength: 260, eyeHeight: 0.8 };
const STORAGE_BOXES = [-4, 0, 4].map((x) => ({
  left: x - 0.6,
  right: x + 0.6,
  bottom: -1,
  top: 3,
}));

function distanceToBox(pose, dx, dy, box) {
  let near = -Infinity;
  let far = Infinity;
  for (const [origin, direction, min, max] of [
    [pose.x, dx, box.left, box.right],
    [pose.y, dy, box.bottom, box.top],
  ]) {
    if (Math.abs(direction) < 1e-9) {
      if (origin < min || origin > max) return Infinity;
      continue;
    }
    const start = (min - origin) / direction;
    const end = (max - origin) / direction;
    near = Math.max(near, Math.min(start, end));
    far = Math.min(far, Math.max(start, end));
  }
  if (far < Math.max(near, 0)) return Infinity;
  return Math.max(near >= 0 ? near : far, 0.02);
}

function distanceToWall(origin, direction, min, max) {
  if (direction > 0) return (max - origin) / direction;
  if (direction < 0) return (min - origin) / direction;
  return Infinity;
}

function traceCameraColumn(pose, column) {
  const sideways = ((column + 0.5) / CAMERA.width - 0.5) * 1.4;
  const dx = Math.cos(pose.heading) - Math.sin(pose.heading) * sideways;
  const dy = Math.sin(pose.heading) + Math.cos(pose.heading) * sideways;
  const wallDistance = Math.min(
    distanceToWall(pose.x, dx, -8, 8),
    distanceToWall(pose.y, dy, -6, 6),
  );
  let distance = Math.max(0.02, wallDistance);
  let storage = false;
  for (const box of STORAGE_BOXES) {
    const hit = distanceToBox(pose, dx, dy, box);
    if (hit < distance) {
      distance = hit;
      storage = true;
    }
  }
  const surfaceHeight = storage ? 1.4 : 2;
  return {
    dx,
    dy,
    distance,
    storage,
    top: CAMERA.horizon - ((surfaceHeight - CAMERA.eyeHeight) * CAMERA.focalLength) / distance,
    bottom: CAMERA.horizon + (CAMERA.eyeHeight * CAMERA.focalLength) / distance,
  };
}

function surfaceColor(pose, ray, row) {
  if (!ray.storage) return [151, 160, 154];
  const worldX = pose.x + ray.dx * ray.distance;
  const worldY = pose.y + ray.dy * ray.distance;
  const rail =
    Math.abs(worldX * 2 - Math.round(worldX * 2)) < 0.06 ||
    Math.abs(worldY * 2 - Math.round(worldY * 2)) < 0.06 ||
    Math.abs((((row - ray.top) / Math.max(ray.bottom - ray.top, 1)) * 3) % 1) < 0.06;
  return rail ? [235, 202, 33] : [54, 76, 85];
}

function floorColor(pose, ray, row) {
  const depth = (CAMERA.eyeHeight * CAMERA.focalLength) / (row - CAMERA.horizon);
  const floorX = pose.x + ray.dx * depth;
  const floorY = pose.y + ray.dy * depth;
  const grid =
    Math.abs(floorX - Math.round(floorX)) < 0.025 || Math.abs(floorY - Math.round(floorY)) < 0.025;
  return grid ? [125, 139, 137] : [184, 187, 178];
}

function pixelColor(pose, ray, row) {
  if (row >= ray.top && row <= ray.bottom) return surfaceColor(pose, ray, row);
  if (row > CAMERA.horizon) return floorColor(pose, ray, row);
  return [125, 143, 151];
}

function crc32(bytes) {
  let checksum = 0xffffffff;
  for (const byte of bytes) {
    checksum ^= byte;
    for (let bit = 0; bit < 8; bit++)
      checksum = checksum & 1 ? 0xedb88320 ^ (checksum >>> 1) : checksum >>> 1;
  }
  return (checksum ^ 0xffffffff) >>> 0;
}

function pngChunk(type, bytes) {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4);
  const checksum = Buffer.alloc(4);
  length.writeUInt32BE(bytes.length);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, bytes])));
  return Buffer.concat([length, name, bytes, checksum]);
}

function encodePng(data) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(CAMERA.width);
  header.writeUInt32BE(CAMERA.height, 4);
  header[8] = 8;
  header[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', zlib.deflateSync(data)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]).toString('base64');
}
function renderMockCamera(pose) {
  const rowBytes = CAMERA.width * 3 + 1;
  const data = Buffer.alloc(rowBytes * CAMERA.height);
  for (let column = 0; column < CAMERA.width; column++) {
    const ray = traceCameraColumn(pose, column);
    for (let row = 0; row < CAMERA.height; row++) {
      const offset = row * rowBytes + 1 + column * 3;
      data.set(pixelColor(pose, ray, row), offset);
    }
  }
  return encodePng(data);
}

module.exports = { renderMockCamera };
