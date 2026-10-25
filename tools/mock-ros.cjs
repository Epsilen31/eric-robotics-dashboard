const http = require('node:http');
const zlib = require('node:zlib');
const { WebSocketServer, WebSocket } = require('ws');
const portFlag = process.argv.indexOf('--port');
const port = Number(portFlag >= 0 ? process.argv[portFlag + 1] : 9090);
let robot, goal, stopped, paused, mission, velocity, lastVelocity, messages;
function reset() {
  robot = { x: 0, y: -4, z: 0, heading: 0 };
  goal = null;
  stopped = false;
  paused = false;
  mission = 'idle';
  velocity = { linear: 0, angular: 0 };
  lastVelocity = 0;
  messages = [];
}
reset();
function header() {
  const ms = Date.now();
  return { frame_id: 'map', stamp: { sec: Math.floor(ms / 1000), nanosec: (ms % 1000) * 1000000 } };
}
function makeCloud() {
  const values = [];
  for (let x = -8; x <= 8; x += 0.3) for (let y = -6; y <= 6; y += 0.3) values.push(x, y, 0);
  for (let z = 0; z <= 2; z += 0.18) {
    for (let x = -8; x <= 8; x += 0.18) values.push(x, -6, z, x, 6, z);
    for (let y = -6; y <= 6; y += 0.18) values.push(-8, y, z, 8, y, z);
  }
  for (const cx of [-4, 0, 4])
    for (let x = cx - 0.6; x <= cx + 0.6; x += 0.15)
      for (let y = -1; y <= 3; y += 0.15) values.push(x, y, 1.4);
  const bytes = Buffer.alloc(values.length * 4);
  values.forEach((v, i) => bytes.writeFloatLE(v, i * 4));
  return {
    header: header(),
    width: values.length / 3,
    height: 1,
    fields: ['x', 'y', 'z'].map((name, i) => ({ name, offset: i * 4, datatype: 7, count: 1 })),
    is_bigendian: false,
    point_step: 12,
    row_step: bytes.length,
    data: bytes.toString('base64'),
    is_dense: true,
  };
}
// A native PNG encoder keeps this deliberately synthetic camera frame offline and dependency-free.
function mockCamera() {
  const width = 640,
    height = 360,
    data = Buffer.alloc((width * 3 + 1) * height);
  // Ray-cast the same room and storage blocks published by makeCloud().
  const boxes = [-4, 0, 4].map((x) => ({ left: x - 0.6, right: x + 0.6, bottom: -1, top: 3 }));
  function hitBox(dx, dy, box) {
    let near = -Infinity;
    let far = Infinity;
    for (const [origin, direction, min, max] of [
      [robot.x, dx, box.left, box.right],
      [robot.y, dy, box.bottom, box.top],
    ]) {
      if (Math.abs(direction) < 1e-9) {
        if (origin < min || origin > max) return Infinity;
        continue;
      }
      const a = (min - origin) / direction;
      const b = (max - origin) / direction;
      near = Math.max(near, Math.min(a, b));
      far = Math.min(far, Math.max(a, b));
    }
    if (far < Math.max(near, 0)) return Infinity;
    // When the simple simulator crosses a rack, render its exit surface.
    return Math.max(near >= 0 ? near : far, 0.02);
  }
  for (let x = 0; x < width; x++) {
    const sideways = ((x + 0.5) / width - 0.5) * 1.4;
    const dx = Math.cos(robot.heading) - Math.sin(robot.heading) * sideways;
    const dy = Math.sin(robot.heading) + Math.cos(robot.heading) * sideways;
    const wall = Math.min(
      dx > 0 ? (8 - robot.x) / dx : dx < 0 ? (-8 - robot.x) / dx : Infinity,
      dy > 0 ? (6 - robot.y) / dy : dy < 0 ? (-6 - robot.y) / dy : Infinity,
    );
    let distance = Math.max(0.02, wall);
    let storage = false;
    for (const box of boxes) {
      const hit = hitBox(dx, dy, box);
      if (hit < distance) {
        distance = hit;
        storage = true;
      }
    }
    const top = 180 - (((storage ? 1.4 : 2) - 0.8) * 260) / distance;
    const bottom = 180 + (0.8 * 260) / distance;
    for (let y = 0; y < height; y++) {
      let rgb = [125, 143, 151];
      if (y >= top && y <= bottom) {
        const worldX = robot.x + dx * distance;
        const worldY = robot.y + dy * distance;
        const rail =
          Math.abs(worldX * 2 - Math.round(worldX * 2)) < 0.06 ||
          Math.abs(worldY * 2 - Math.round(worldY * 2)) < 0.06 ||
          Math.abs((((y - top) / Math.max(bottom - top, 1)) * 3) % 1) < 0.06;
        rgb = storage ? (rail ? [235, 202, 33] : [54, 76, 85]) : [151, 160, 154];
      } else if (y > 180) {
        const depth = (0.8 * 260) / (y - 180);
        const floorX = robot.x + dx * depth;
        const floorY = robot.y + dy * depth;
        const grid =
          Math.abs(floorX - Math.round(floorX)) < 0.025 ||
          Math.abs(floorY - Math.round(floorY)) < 0.025;
        rgb = grid ? [125, 139, 137] : [184, 187, 178];
      }
      const offset = y * (width * 3 + 1) + 1 + x * 3;
      data.set(rgb, offset);
    }
  }
  function crc(bytes) {
    let c = 0xffffffff;
    for (const b of bytes) {
      c ^= b;
      for (let i = 0; i < 8; i++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    return (c ^ 0xffffffff) >>> 0;
  }
  function chunk(type, bytes) {
    const name = Buffer.from(type),
      length = Buffer.alloc(4),
      sum = Buffer.alloc(4);
    length.writeUInt32BE(bytes.length);
    sum.writeUInt32BE(crc(Buffer.concat([name, bytes])));
    return Buffer.concat([length, name, bytes, sum]);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(data)),
    chunk('IEND', Buffer.alloc(0)),
  ]).toString('base64');
}
const cloud = makeCloud();
let cameraPose = '';
let camera;
function cameraFrame() {
  const pose = `${robot.x},${robot.y},${robot.heading}`;
  if (pose !== cameraPose) {
    camera = mockCamera();
    cameraPose = pose;
  }
  return camera;
}
const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.url === '/health') res.end(JSON.stringify({ ok: true, simulator: true }));
  else if (req.url === '/disconnect' && req.method === 'POST') {
    for (const client of wss.clients) client.close();
    res.end(JSON.stringify({ ok: true }));
  } else if (req.url === '/state')
    res.end(JSON.stringify({ robot, goal, stopped, paused, mission, messages }));
  else if (req.url === '/reset' && req.method === 'POST') {
    reset();
    res.end(JSON.stringify({ ok: true }));
  } else {
    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});
const wss = new WebSocketServer({ server, maxPayload: 1000000 });
function packet(topic) {
  if (topic === '/points') return { ...cloud, header: header() };
  if (topic === '/camera/image/compressed')
    return { header: header(), format: 'png', data: cameraFrame() };
  if (topic === '/battery_state')
    return { header: header(), percentage: 0.87, voltage: 24.5, present: true };
  if (topic === '/dashboard/mission_status') return { data: mission };
  if (topic === '/odom')
    return {
      header: header(),
      child_frame_id: 'base_link',
      pose: {
        pose: {
          position: { x: robot.x, y: robot.y, z: 0 },
          orientation: {
            x: 0,
            y: 0,
            z: Math.sin(robot.heading / 2),
            w: Math.cos(robot.heading / 2),
          },
        },
        covariance: Array(36).fill(0),
      },
    };
  return null;
}
function publish(socket, topic) {
  const msg = packet(topic);
  if (msg && socket.readyState === WebSocket.OPEN)
    socket.send(JSON.stringify({ op: 'publish', topic, msg }));
}
wss.on('connection', (socket) => {
  socket.subscriptions = new Set();
  socket.on('close', () => {
    if (![...wss.clients].some((c) => c.readyState === WebSocket.OPEN)) {
      velocity = { linear: 0, angular: 0 };
      goal = null;
      mission = 'idle';
    }
  });
  socket.on('message', (raw) => {
    try {
      const p = JSON.parse(raw.toString());
      messages.push(p);
      if (messages.length > 300) messages.shift();
      if (p.op === 'subscribe') {
        socket.subscriptions.add(p.topic);
        publish(socket, p.topic);
        return;
      }
      if (p.op === 'unsubscribe') {
        socket.subscriptions.delete(p.topic);
        return;
      }
      if (p.op !== 'publish' || !p.msg) return;
      if (p.topic === '/cmd_vel') {
        const linear = p.msg.linear?.x,
          angular = p.msg.angular?.z;
        if (!Number.isFinite(linear) || !Number.isFinite(angular)) return;
        velocity = {
          linear: Math.max(-0.3, Math.min(0.3, linear)),
          angular: Math.max(-1, Math.min(1, angular)),
        };
        lastVelocity = Date.now();
        if (linear || angular) {
          goal = null;
          mission = 'manual';
        }
      } else if (p.topic === '/goal_pose') {
        const point = p.msg.pose?.position;
        if (
          stopped ||
          p.msg.header?.frame_id !== 'map' ||
          !point ||
          ![point.x, point.y].every(Number.isFinite)
        )
          return;
        goal = { x: point.x, y: point.y };
        paused = false;
        mission = 'active';
      } else if (p.topic === '/dashboard/stop') {
        stopped = Boolean(p.msg.data);
        velocity = { linear: 0, angular: 0 };
        goal = null;
        mission = stopped ? 'stopped' : 'idle';
      } else if (p.topic === '/dashboard/pause') {
        paused = Boolean(p.msg.data);
        velocity = { linear: 0, angular: 0 };
        mission = paused ? 'paused' : goal ? 'active' : 'idle';
      }
    } catch {
      /* Invalid client packets are ignored by this local simulator. */
    }
  });
});
let tick = 0;
const timer = setInterval(() => {
  tick++;
  if (!stopped && !paused) {
    if (goal) {
      const dx = goal.x - robot.x,
        dy = goal.y - robot.y,
        d = Math.hypot(dx, dy);
      if (d < 0.1) {
        goal = null;
        mission = 'completed';
      } else {
        robot.heading = Math.atan2(dy, dx);
        robot.x += (dx / d) * 0.08;
        robot.y += (dy / d) * 0.08;
      }
    } else if (Date.now() - lastVelocity < 350) {
      robot.heading += velocity.angular * 0.1;
      robot.x += Math.cos(robot.heading) * velocity.linear * 0.1;
      robot.y += Math.sin(robot.heading) * velocity.linear * 0.1;
    }
  }
  for (const socket of wss.clients)
    for (const topic of socket.subscriptions)
      if (
        topic === '/camera/image/compressed'
          ? tick % 2 === 0
          : topic === '/points' || topic === '/battery_state'
            ? tick % 10 === 0
            : true
      )
        publish(socket, topic);
}, 100);
wss.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(
      `Port ${port} is already in use. If the demo is already running, connect the dashboard to ws://127.0.0.1:${port}.`,
    );
    console.error(
      'To start another demo, run: npm run ros:demo -- --port 9091 and use ws://127.0.0.1:9091 in the dashboard.',
    );
  } else {
    console.error(`Mock ROS bridge could not start: ${error.message}`);
  }
  process.exit(1);
});
server.listen(port, '127.0.0.1', () =>
  console.log(`Mock ROS bridge: ws://127.0.0.1:${port} (synthetic local data, no physical robot)`),
);
function shutdown() {
  clearInterval(timer);
  for (const c of wss.clients) c.close();
  wss.close();
  server.close(() => process.exit(0));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
