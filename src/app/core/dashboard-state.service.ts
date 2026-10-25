import { Injectable, NgZone, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { isWalkable, planDemoRoute } from './demo/facility';
import { FACILITY } from './constants/facility.constants';
import type { Position2D, RobotPose2D } from './models/geometry.model';
import type {
  DashboardView,
  DriveCommand,
  MapMode,
  MissionStatus,
  NavigationGoal,
  OperatingMode,
} from './models/navigation.model';
import { DASHBOARD_SETTINGS, MISSION_LABELS } from './constants/dashboard.constants';
import { RosService } from './ros.service';
@Injectable({ providedIn: 'root' })
export class DashboardStateService implements OnDestroy {
  readonly ros = inject(RosService);
  private readonly zone = inject(NgZone);
  readonly activeView = signal<DashboardView>('map');
  readonly mapMode = signal<MapMode>('floor');
  readonly mode = signal<OperatingMode>('auto');
  readonly stopped = signal(false);
  readonly paused = signal(false);
  readonly zoom = signal(1);
  readonly selectingGoal = signal(false);
  readonly goal = signal<NavigationGoal | null>(null);
  readonly robot = signal<RobotPose2D>({ ...FACILITY.start, heading: -Math.PI / 2 });
  readonly route = signal<Position2D[]>([]);
  readonly mission = signal<MissionStatus>('idle');
  readonly notice = signal('');
  readonly connectionPanel = signal(false);
  readonly resetRevision = signal(0);
  readonly drive = signal<DriveCommand>({ linear: 0, angular: 0 });
  readonly manualEnabled = computed(
    () =>
      this.mode() === 'manual' &&
      !this.stopped() &&
      !this.paused() &&
      ['demo', 'connected'].includes(this.ros.status()),
  );
  readonly missionLabel = computed(() => {
    if (this.stopped()) return 'STOPPED';
    return MISSION_LABELS[this.mission()];
  });
  private noticeTimer?: ReturnType<typeof setTimeout>;
  private readonly movementTimer: ReturnType<typeof setInterval>;
  private previousRosStatus = this.ros.status();
  constructor() {
    effect(() => {
      const status = this.ros.status();
      if (status === this.previousRosStatus) return;
      this.previousRosStatus = status;
      clearTimeout(this.noticeTimer);
      this.notice.set('');
      this.goal.set(null);
      this.route.set([]);
      this.selectingGoal.set(false);
      this.drive.set({ linear: 0, angular: 0 });
      this.paused.set(false);
      this.mission.set(status === 'disconnected' ? 'interrupted' : 'idle');
      if (status === 'connected') {
        this.activeView.set('map');
        this.mapMode.set('scan');
        if (this.stopped()) this.ros.publishStop(true);
      }
      if (status === 'demo') this.mapMode.set('floor');
    });
    effect(() => {
      const status = this.ros.mission();
      if (
        this.ros.status() !== 'connected' ||
        !this.goal() ||
        this.stopped() ||
        !['submitted', 'running', 'paused'].includes(this.mission())
      )
        return;
      if (status === 'active') this.mission.set('running');
      else if (status === 'completed') {
        this.mission.set('completed');
        this.paused.set(false);
      } else if (status === 'paused') {
        this.mission.set('paused');
        this.paused.set(true);
      } else if (status === 'stopped') this.mission.set('stopped');
    });
    this.movementTimer = this.zone.runOutsideAngular(() =>
      setInterval(
        () => this.zone.run(() => this.updateMovement()),
        DASHBOARD_SETTINGS.movementIntervalMs,
      ),
    );
  }
  notify(message: string): void {
    clearTimeout(this.noticeTimer);
    this.notice.set(message);
    this.noticeTimer = setTimeout(() => this.notice.set(''), DASHBOARD_SETTINGS.noticeDurationMs);
  }
  showFloorPlan(): void {
    this.activeView.set('map');
    if (this.ros.status() !== 'demo') {
      this.mapMode.set('scan');
      this.notify('Connected ROS data is shown in the 3D map.');
    } else this.mapMode.set('floor');
  }
  showPointCloudMap(): void {
    this.activeView.set('map');
    this.mapMode.set('scan');
  }
  startGoalSelection(): void {
    if (this.stopped()) {
      this.notify('Release emergency stop before selecting a goal.');
      return;
    }
    if (!['demo', 'connected'].includes(this.ros.status())) {
      this.notify('Reconnect to ROS or choose offline demo first.');
      return;
    }
    this.activeView.set('map');
    this.mapMode.set(this.ros.status() === 'demo' ? 'floor' : 'scan');
    this.selectingGoal.set(true);
    this.notify(
      this.ros.status() === 'demo'
        ? 'Click an open floor area to select a destination.'
        : 'Click a point on the live 3D map to select a destination.',
    );
  }
  chooseDemoGoal(position: Position2D): void {
    if (!this.selectingGoal() || this.ros.status() !== 'demo') return;
    if (!planDemoRoute(this.robot(), position)) {
      this.notify('Choose an open, reachable floor area away from walls and storage.');
      return;
    }
    this.goal.set({ ...position, z: 0, source: 'demo', frameId: 'demo-floor' });
    this.selectingGoal.set(false);
    this.route.set([]);
    this.mission.set('ready');
    this.paused.set(false);
    this.notify('Destination selected. Press INITIATE to start the demo mission.');
  }
  chooseRosGoal(x: number, y: number, z: number, frameId: string): void {
    if (!this.selectingGoal() || this.ros.status() !== 'connected') return;
    if (frameId !== this.ros.config().frameId) {
      this.notify('Cloud frame and configured goal frame must match.');
      return;
    }
    this.ros.mission.set('');
    this.goal.set({ x, y, z, source: 'ros', frameId });
    this.selectingGoal.set(false);
    this.mission.set('ready');
    this.notify('Live-map destination selected. Press INITIATE to publish it.');
  }
  initiate(): void {
    if (this.stopped()) {
      this.notify('Release emergency stop before initiating.');
      return;
    }
    if (this.mode() !== 'auto') {
      this.notify('Select AUTO mode to initiate a mission.');
      return;
    }
    const goal = this.goal();
    if (!goal) {
      this.startGoalSelection();
      return;
    }
    if (goal.source === 'demo' && this.ros.status() === 'demo') {
      const route = planDemoRoute(this.robot(), goal);
      if (!route) {
        this.notify('Destination is not reachable. Choose another goal.');
        return;
      }
      this.route.set(route);
      this.paused.set(false);
      this.mission.set('running');
      this.notify('Demo mission started. The robot follows the highlighted route.');
    } else if (
      goal.source === 'ros' &&
      this.ros.status() === 'connected' &&
      Date.now() - this.ros.cloudReceivedAt() < DASHBOARD_SETTINGS.liveCloudMaxAgeMs &&
      goal.frameId === this.ros.config().frameId &&
      this.ros.publishGoal(goal.x, goal.y, goal.z)
    ) {
      this.ros.publishPause(false);
      this.paused.set(false);
      this.mission.set('submitted');
      this.notify('Goal published. Waiting for the navigation adapter to report progress.');
    } else
      this.notify('A fresh live map and connected ROS bridge are required. Select the goal again.');
  }
  setMode(mode: OperatingMode): void {
    if (mode === this.mode()) return;
    this.mode.set(mode);
    this.setDrive(0, 0);
    if (mode === 'manual' && ['running', 'submitted'].includes(this.mission())) {
      this.paused.set(true);
      this.mission.set('paused');
      this.ros.publishPause(true);
    }
  }
  togglePause(): void {
    if (this.stopped()) return;
    const next = !this.paused();
    this.paused.set(next);
    this.setDrive(0, 0);
    this.ros.publishPause(next);
    if (next && ['running', 'submitted'].includes(this.mission())) this.mission.set('paused');
    else if (!next && this.mission() === 'paused') {
      if (this.mode() === 'auto')
        this.mission.set(this.ros.status() === 'demo' ? 'running' : 'submitted');
      else this.mission.set('ready');
    }
  }
  toggleStop(): void {
    const next = !this.stopped();
    this.stopped.set(next);
    this.setDrive(0, 0);
    this.ros.publishStop(next);
    this.route.set([]);
    this.selectingGoal.set(false);
    this.paused.set(false);
    this.mission.set('stopped');
    this.notify(
      next ? 'Software stop activated.' : 'Stop released. Select or initiate a goal to continue.',
    );
  }
  setDrive(linear: number, angular: number): void {
    if (!this.manualEnabled()) {
      linear = 0;
      angular = 0;
    }
    this.drive.set({ linear, angular });
    this.ros.publishVelocity(linear, angular);
  }
  private updateMovement(): void {
    const drive = this.drive();
    if (this.ros.status() === 'connected') {
      if (this.manualEnabled()) this.ros.publishVelocity(drive.linear, drive.angular);
      return;
    }
    if (this.ros.status() !== 'demo' || this.stopped() || this.paused()) return;
    if (this.mode() === 'manual') this.moveManualDemo();
    else if (this.mission() === 'running') this.advanceDemoMission();
  }
  private moveManualDemo(): void {
    const { linear, angular } = this.drive();
    if (!linear && !angular) return;
    const robot = this.robot();
    const heading = robot.heading - angular * (DASHBOARD_SETTINGS.movementIntervalMs / 1000);
    const next = {
      x: robot.x + Math.cos(heading) * linear * DASHBOARD_SETTINGS.manualDistanceScale,
      y: robot.y + Math.sin(heading) * linear * DASHBOARD_SETTINGS.manualDistanceScale,
      heading,
    };
    this.robot.set(isWalkable(next) ? next : { ...robot, heading });
  }
  private advanceDemoMission(): void {
    const [target, ...rest] = this.route();
    if (!target) {
      this.mission.set('completed');
      this.notify('Demo mission complete.');
      return;
    }
    const robot = this.robot();
    const dx = target.x - robot.x,
      dy = target.y - robot.y,
      length = Math.hypot(dx, dy);
    if (length < DASHBOARD_SETTINGS.waypointTolerance) {
      this.robot.set({ ...target, heading: robot.heading });
      this.route.set(rest);
      return;
    }
    this.robot.set({
      x: robot.x + (dx / length) * DASHBOARD_SETTINGS.missionStepDistance,
      y: robot.y + (dy / length) * DASHBOARD_SETTINGS.missionStepDistance,
      heading: Math.atan2(dy, dx),
    });
  }
  setZoom(value: number): void {
    if (Number.isFinite(value))
      this.zoom.set(
        Math.min(DASHBOARD_SETTINGS.maxZoom, Math.max(DASHBOARD_SETTINGS.minZoom, value)),
      );
  }
  ngOnDestroy(): void {
    clearInterval(this.movementTimer);
    clearTimeout(this.noticeTimer);
    this.ros.publishVelocity(0, 0);
  }
}
