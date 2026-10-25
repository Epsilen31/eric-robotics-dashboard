const http = require('node:http');
const { renderMockCamera } = require('./mock-camera.cjs');
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
const cloud = makeCloud();
let cameraPose = '';
let camera;
function cameraFrame() {
  const pose = `${robot.x},${robot.y},${robot.heading}`;
  if (pose !== cameraPose) {
    camera = renderMockCamera(robot);
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
        covariance: new Array(36).fill(0),
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
  socket.on('message', (raw) => handleClientMessage(socket, raw));
});

function applyVelocity(message) {
  const linear = message.linear?.x;
  const angular = message.angular?.z;
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
}

function applyGoal(message) {
  const point = message.pose?.position;
  if (
    stopped ||
    message.header?.frame_id !== 'map' ||
    !point ||
    ![point.x, point.y].every(Number.isFinite)
  )
    return;
  goal = { x: point.x, y: point.y };
  paused = false;
  mission = 'active';
}

function applyStop(message) {
  stopped = Boolean(message.data);
  velocity = { linear: 0, angular: 0 };
  goal = null;
  mission = stopped ? 'stopped' : 'idle';
}

function applyPause(message) {
  paused = Boolean(message.data);
  velocity = { linear: 0, angular: 0 };
  if (paused) mission = 'paused';
  else mission = goal ? 'active' : 'idle';
}

const commandHandlers = new Map([
  ['/cmd_vel', applyVelocity],
  ['/goal_pose', applyGoal],
  ['/dashboard/stop', applyStop],
  ['/dashboard/pause', applyPause],
]);

function decodeClientMessage(raw) {
  if (typeof raw === 'string') return raw;
  if (Buffer.isBuffer(raw)) return raw.toString('utf8');
  if (raw instanceof ArrayBuffer) return Buffer.from(raw).toString('utf8');
  if (Array.isArray(raw) && raw.every(Buffer.isBuffer)) return Buffer.concat(raw).toString('utf8');
  throw new TypeError('Unsupported WebSocket message format');
}

function dispatchClientPacket(socket, packet) {
  if (packet.op === 'subscribe') {
    socket.subscriptions.add(packet.topic);
    publish(socket, packet.topic);
    return;
  }
  if (packet.op === 'unsubscribe') {
    socket.subscriptions.delete(packet.topic);
    return;
  }
  if (packet.op !== 'publish' || !packet.msg) return;
  commandHandlers.get(packet.topic)?.(packet.msg);
}

function handleClientMessage(socket, raw) {
  try {
    const packet = JSON.parse(decodeClientMessage(raw));
    messages.push(packet);
    if (messages.length > 300) messages.shift();
    dispatchClientPacket(socket, packet);
  } catch {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(
        JSON.stringify({ op: 'status', level: 'error', msg: 'Invalid ROS client packet' }),
      );
    }
  }
}

function advanceGoal() {
  const dx = goal.x - robot.x;
  const dy = goal.y - robot.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 0.1) {
    goal = null;
    mission = 'completed';
    return;
  }
  robot.heading = Math.atan2(dy, dx);
  robot.x += (dx / distance) * 0.08;
  robot.y += (dy / distance) * 0.08;
}

function updateRobot() {
  if (stopped || paused) return;
  if (goal) {
    advanceGoal();
    return;
  }
  if (Date.now() - lastVelocity >= 350) return;
  robot.heading += velocity.angular * 0.1;
  robot.x += Math.cos(robot.heading) * velocity.linear * 0.1;
  robot.y += Math.sin(robot.heading) * velocity.linear * 0.1;
}

const topicIntervals = new Map([
  ['/camera/image/compressed', 2],
  ['/points', 10],
  ['/battery_state', 10],
]);
let tick = 0;
function publishSubscribedTopics() {
  for (const socket of wss.clients) {
    for (const topic of socket.subscriptions) {
      const interval = topicIntervals.get(topic) ?? 1;
      if (tick % interval === 0) publish(socket, topic);
    }
  }
}
const timer = setInterval(() => {
  tick++;
  updateRobot();
  publishSubscribedTopics();
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
