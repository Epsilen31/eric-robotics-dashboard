import test from 'node:test';
import { decodeBase64Bytes } from '../../src/app/core/utils/binary.util';
import assert from 'node:assert/strict';
import { decodePointCloud } from '../../src/app/core/utils/point-cloud.util';
import { isWalkable, planDemoRoute } from '../../src/app/core/demo/facility';
import { FACILITY } from '../../src/app/core/constants/facility.constants';
import { PointCloudMessage } from '../../src/app/core/models/point-cloud.model';
function cloud(bigEndian = false): PointCloudMessage {
  const bytes = new Uint8Array(112),
    view = new DataView(bytes.buffer);
  for (let i = 0; i < 4; i++) {
    const offset = Math.floor(i / 2) * 56 + (i % 2) * 24;
    view.setFloat64(offset + 4, i + 0.5, !bigEndian);
    view.setFloat32(offset + 12, i + 2, !bigEndian);
    view.setFloat32(offset + 16, i + 4, !bigEndian);
  }
  return {
    header: { frame_id: 'map' },
    width: 2,
    height: 2,
    point_step: 24,
    row_step: 56,
    is_bigendian: bigEndian,
    fields: [
      { name: 'x', offset: 4, datatype: 8, count: 1 },
      { name: 'y', offset: 12, datatype: 7, count: 1 },
      { name: 'z', offset: 16, datatype: 7, count: 1 },
    ],
    data: Buffer.from(bytes).toString('base64'),
  };
}
test('PointCloud2: organized row padding, offsets, mixed float widths and both byte orders', () => {
  for (const bigEndian of [false, true]) {
    const decoded = decodePointCloud(cloud(bigEndian));
    assert.equal(decoded.frameId, 'map');
    assert.deepEqual([...decoded.positions], [0.5, 2, 4, 1.5, 3, 5, 2.5, 4, 6, 3.5, 5, 7]);
  }
});
test('PointCloud2: bounded downsampling and non-finite filtering', () => {
  assert.equal(decodePointCloud(cloud(), 2).positions.length, 6);
  const msg = cloud();
  const data = Buffer.from(msg.data as string, 'base64');
  data.writeDoubleLE(NaN, 4);
  msg.data = [...data];
  assert.equal(decodePointCloud(msg).positions.length, 9);
});
test('PointCloud2: reject malformed, truncated and oversized packets before rendering', () => {
  assert.throws(() => decodePointCloud({ ...cloud(), data: 'AAAA' }), /Truncated/);
  const bad = cloud();
  bad.fields[0].offset = 23;
  assert.throws(() => decodePointCloud(bad), /Unsupported x/);
  assert.throws(() => decodePointCloud({ ...cloud(), height: 100000000 }), /oversized/);
  assert.throws(() => decodePointCloud({ ...cloud(), row_step: 1 }), /Invalid/);
});
test('Demo route: walls and storage are excluded; a reachable route joins both endpoints', () => {
  assert.equal(isWalkable({ x: 340, y: 170 }), false);
  assert.equal(isWalkable({ x: 100, y: 100 }), false);
  assert.equal(planDemoRoute(FACILITY.start, { x: 340, y: 170 }), null);
  const goal = { x: 400, y: 65 };
  const route = planDemoRoute(FACILITY.start, goal);
  assert.ok(route);
  assert.deepEqual(route[0], FACILITY.start);
  assert.deepEqual(route.at(-1), goal);
  for (let i = 1; i < route.length; i++)
    for (let t = 0; t <= 1; t += 0.1)
      assert.ok(
        isWalkable({
          x: route[i - 1].x + (route[i].x - route[i - 1].x) * t,
          y: route[i - 1].y + (route[i].y - route[i - 1].y) * t,
        }),
      );
});

test('Base64 byte conversion preserves zero, ASCII and high-bit bytes in a Blob', async () => {
  const bytes = Buffer.from([0, 127, 128, 255]);
  const decoded: Uint8Array<ArrayBuffer> = decodeBase64Bytes(bytes.toString('base64'));
  const blob = new Blob([decoded]);
  assert.deepEqual([...new Uint8Array(await blob.arrayBuffer())], [...bytes]);
});
