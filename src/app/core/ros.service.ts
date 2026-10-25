import { Injectable, NgZone, OnDestroy, inject, signal } from '@angular/core';
import { decodePointCloud } from './utils/point-cloud.util';
import { DecodedPointCloud, PointCloudMessage } from './models/point-cloud.model';
import type {
  CameraMessage,
  OdometryMessage,
  RosConfig,
  RosConnectionStatus,
  RosPacket,
} from './models/ros.model';
import type { RobotPose } from './models/geometry.model';
import { DEFAULT_ROS_CONFIG, ROS_LIMITS } from './constants/ros.constants';
import { decodeBase64Bytes } from './utils/binary.util';
@Injectable({ providedIn: 'root' })
export class RosService implements OnDestroy {
  private readonly zone = inject(NgZone);
  readonly config = signal<RosConfig>(DEFAULT_ROS_CONFIG);
  readonly status = signal<RosConnectionStatus>('demo');
  readonly cloud = signal<DecodedPointCloud | null>(null);
  readonly pose = signal<RobotPose | null>(null);
  readonly battery = signal<number | null>(null);
  readonly cameraImage = signal('');
  readonly mission = signal('');
  readonly error = signal('');
  readonly cloudReceivedAt = signal(0);
  private socket?: WebSocket;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private destroyed = false;
  private reconnectEnabled = false;
  private imageUrl = '';
  private initialization?: Promise<void>;
  initialize(): Promise<void> {
    this.initialization ??= this.loadDefaults();
    return this.initialization;
  }
  private async loadDefaults(): Promise<void> {
    try {
      const response = await fetch('/assets/ros-config.json');
      if (!response.ok) throw new Error('ROS defaults unavailable');
      const value: Partial<RosConfig> = await response.json();
      if (this.destroyed || this.reconnectEnabled) return;
      const config = { ...DEFAULT_ROS_CONFIG, ...value };
      this.config.set(config);
      const bridgeUrl = new URLSearchParams(location.search).get('ros');
      if (bridgeUrl) this.connect({ ...config, bridgeUrl });
    } catch {
      // Missing optional defaults must not prevent the offline demo from starting.
    }
  }
  connect(config: RosConfig): void {
    this.useOfflineDemo();
    try {
      const url = new URL(config.bridgeUrl);
      if (!['ws:', 'wss:'].includes(url.protocol))
        throw new Error('Use a ws:// or wss:// bridge URL.');
      if (
        Object.entries(config).some(
          ([key, value]) => typeof value !== 'string' || (key !== 'bridgeUrl' && !value.trim()),
        )
      )
        throw new Error('All topic and frame fields are required.');
      this.config.set({ ...config });
      this.reconnectEnabled = true;
      this.open();
    } catch (error) {
      this.error.set((error as Error).message);
    }
  }
  private open(): void {
    if (!this.reconnectEnabled || this.destroyed) return;
    this.status.set('connecting');
    try {
      const socket = new WebSocket(this.config().bridgeUrl);
      this.socket = socket;
      socket.onopen = () => {
        if (socket !== this.socket) return;
        this.zone.run(() => {
          this.status.set('connected');
          this.cloud.set(null);
          this.pose.set(null);
          this.cloudReceivedAt.set(0);
          this.mission.set('');
          this.error.set('');
        });
        const config = this.config();
        for (const [topic, type] of [
          [config.pointsTopic, 'sensor_msgs/msg/PointCloud2'],
          [config.cameraTopic, 'sensor_msgs/msg/CompressedImage'],
          [config.odometryTopic, 'nav_msgs/msg/Odometry'],
          [config.batteryTopic, 'sensor_msgs/msg/BatteryState'],
          [config.missionTopic, 'std_msgs/msg/String'],
        ])
          this.send({
            op: 'subscribe',
            topic,
            type,
            throttle_rate:
              topic === config.pointsTopic
                ? ROS_LIMITS.cloudThrottleMs
                : ROS_LIMITS.telemetryThrottleMs,
            queue_length: 1,
          });
        for (const [topic, type] of [
          [config.velocityTopic, 'geometry_msgs/msg/Twist'],
          [config.goalTopic, 'geometry_msgs/msg/PoseStamped'],
          [config.stopTopic, 'std_msgs/msg/Bool'],
          [config.pauseTopic, 'std_msgs/msg/Bool'],
        ])
          this.send({ op: 'advertise', topic, type });
        // A new session always starts with no requested movement.
        this.publishVelocity(0, 0);
      };
      socket.onmessage = (event) => this.receiveMessage(socket, event);
      socket.onerror = () => socket.close();
      socket.onclose = () => {
        if (socket !== this.socket) return;
        this.zone.run(() => this.status.set('disconnected'));
        this.scheduleReconnect();
      };
    } catch (error) {
      this.status.set('disconnected');
      this.error.set((error as Error).message);
      this.scheduleReconnect();
    }
  }
  private scheduleReconnect(): void {
    if (!this.reconnectEnabled || this.destroyed) return;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => this.open(), ROS_LIMITS.reconnectDelayMs);
  }
  private receiveMessage(socket: WebSocket, event: MessageEvent): void {
    if (
      socket !== this.socket ||
      typeof event.data !== 'string' ||
      event.data.length > ROS_LIMITS.maxPacketCharacters
    )
      return;
    const raw = event.data;
    this.zone.run(() => this.processPacket(raw));
  }
  private processPacket(raw: string): void {
    try {
      const packet = JSON.parse(raw) as RosPacket;
      if (packet.op === 'status' && packet.level === 'error') {
        this.error.set(
          (typeof packet.msg === 'string' ? packet.msg : JSON.stringify(packet.msg)) ||
            'ROS bridge reported an error',
        );
        return;
      }
      if (packet.op !== 'publish' || !packet.msg) return;
      this.dispatchMessage(packet.topic, packet.msg);
    } catch (error) {
      this.error.set(`ROS data: ${(error as Error).message}`);
    }
  }
  private dispatchMessage(topic: string | undefined, message: unknown): void {
    const config = this.config();
    switch (topic) {
      case config.pointsTopic:
        this.updateCloud(message as PointCloudMessage);
        break;
      case config.odometryTopic:
        this.updatePose(message as OdometryMessage);
        break;
      case config.batteryTopic:
        this.updateBattery(message as { percentage?: number });
        break;
      case config.missionTopic:
        this.updateMission(message as { data?: unknown });
        break;
      case config.cameraTopic:
        this.updateImage(message as CameraMessage);
        break;
    }
  }
  private updateCloud(message: PointCloudMessage): void {
    this.cloud.set(decodePointCloud(message));
    this.cloudReceivedAt.set(Date.now());
    this.error.set('');
  }
  private updatePose(message: OdometryMessage): void {
    const position = message.pose?.pose?.position;
    const orientation = message.pose?.pose?.orientation;
    if (!position || !orientation) return;
    const { x, y, z, w } = orientation;
    if (![position.x, position.y, position.z, x, y, z, w].every(Number.isFinite)) return;
    this.pose.set({
      ...position,
      heading: Math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z)),
      frameId: message.header?.frame_id || '',
    });
  }
  private updateBattery(message: { percentage?: number }): void {
    const percentage = message.percentage;
    const valid =
      typeof percentage === 'number' &&
      Number.isFinite(percentage) &&
      percentage >= 0 &&
      percentage <= 1;
    this.battery.set(valid ? Math.round(percentage * 100) : null);
  }
  private updateMission(message: { data?: unknown }): void {
    if (typeof message.data === 'string') this.mission.set(message.data);
  }
  private updateImage(message: CameraMessage): void {
    const type = message.format?.toLowerCase().includes('png') ? 'image/png' : 'image/jpeg';
    if (typeof message.data !== 'string' || message.data.length > ROS_LIMITS.maxCameraCharacters)
      return;
    const bytes = decodeBase64Bytes(message.data);
    const next = URL.createObjectURL(new Blob([bytes], { type }));
    this.cameraImage.set(next);
    if (this.imageUrl) URL.revokeObjectURL(this.imageUrl);
    this.imageUrl = next;
  }
  private send(packet: object): boolean {
    if (this.socket?.readyState !== WebSocket.OPEN) return false;
    this.socket.send(JSON.stringify(packet));
    return true;
  }
  publishVelocity(linear: number, angular: number): void {
    this.send({
      op: 'publish',
      topic: this.config().velocityTopic,
      msg: {
        linear: { x: linear, y: 0, z: 0 },
        angular: { x: 0, y: 0, z: angular },
      },
    });
  }
  publishStop(stopped: boolean): void {
    this.publishVelocity(0, 0);
    this.send({ op: 'publish', topic: this.config().stopTopic, msg: { data: stopped } });
  }
  publishPause(paused: boolean): void {
    this.publishVelocity(0, 0);
    this.send({ op: 'publish', topic: this.config().pauseTopic, msg: { data: paused } });
  }
  publishGoal(x: number, y: number, z: number): boolean {
    if (this.status() !== 'connected') return false;
    const now = Date.now();
    return this.send({
      op: 'publish',
      topic: this.config().goalTopic,
      msg: {
        header: {
          frame_id: this.config().frameId,
          stamp: { sec: Math.floor(now / 1000), nanosec: (now % 1000) * 1000000 },
        },
        pose: { position: { x, y, z }, orientation: { x: 0, y: 0, z: 0, w: 1 } },
      },
    });
  }
  useOfflineDemo(): void {
    this.publishVelocity(0, 0);
    this.reconnectEnabled = false;
    clearTimeout(this.reconnectTimer);
    const socket = this.socket;
    this.socket = undefined;
    socket?.close();
    this.status.set('demo');
    this.cloud.set(null);
    this.pose.set(null);
    this.battery.set(null);
    this.cameraImage.set('');
    this.mission.set('');
    this.error.set('');
    this.cloudReceivedAt.set(0);
    if (this.imageUrl) URL.revokeObjectURL(this.imageUrl);
    this.imageUrl = '';
  }
  ngOnDestroy(): void {
    this.destroyed = true;
    this.useOfflineDemo();
  }
}
