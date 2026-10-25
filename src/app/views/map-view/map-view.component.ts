import {
  AfterViewInit,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { DashboardStateService } from '../../core/dashboard-state.service';
import { FACILITY } from '../../core/constants/facility.constants';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PCDLoader } from 'three/addons/loaders/PCDLoader.js';

@Component({
  selector: 'app-map-view',
  standalone: true,
  templateUrl: './map-view.component.html',
  styleUrl: './map-view.component.scss',
})
export class MapViewComponent implements AfterViewInit, OnDestroy {
  @ViewChild('viewport', { static: true }) private viewport!: ElementRef<HTMLDivElement>;
  private readonly zone = inject(NgZone);
  readonly state = inject(DashboardStateService);
  readonly panOffset = signal({ x: 0, y: 0 });
  private panStart?: { pointer: number; x: number; y: number; offsetX: number; offsetY: number };
  readonly isPointCloudView = computed(() => this.state.mapMode() === 'scan');
  readonly message = signal('Loading map…');
  private readonly scene = new THREE.Scene();
  private readonly orbitCamera = new THREE.PerspectiveCamera(50, 1, 0.01, 10000);
  private renderer?: THREE.WebGLRenderer;
  private controls?: OrbitControls;
  private resizeObserver?: ResizeObserver;
  private offlineCloud?: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  private extent = 10;
  private liveCloud?: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  private liveRobot?: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  private liveGoal?: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  private scanStart = { x: 0, y: 0 };
  private fittedLive = false;
  readonly scanMessage = computed(() =>
    this.state.ros.status() === 'demo'
      ? this.message()
      : this.state.ros.status() !== 'connected'
        ? 'ROS disconnected. Reconnect or use offline demo.'
        : this.state.ros.error() ||
          (!this.state.ros.cloud() ? 'Waiting for ROS point cloud...' : ''),
  );
  private destroyed = false;

  constructor() {
    effect(() => {
      this.isPointCloudView();
      this.state.selectingGoal();
      this.configureControls();
    });
    effect(() => {
      this.state.resetRevision();
      this.resetView();
    });
    effect(() => {
      const data = this.state.ros.cloud(),
        status = this.state.ros.status();
      if (!this.renderer) return;
      if (this.offlineCloud) this.offlineCloud.visible = status === 'demo';
      if (data) this.renderLiveCloud(data.positions);
      else if (this.liveCloud) {
        this.scene.remove(this.liveCloud);
        this.disposeCloud(this.liveCloud);
        this.liveCloud = undefined;
        this.fittedLive = false;
        if (status === 'demo' && this.offlineCloud?.geometry.boundingBox)
          this.fitBounds(this.offlineCloud.geometry.boundingBox);
      }
    });
    effect(() => {
      const pose = this.state.ros.pose(),
        data = this.state.ros.cloud();
      if (!this.renderer) return;
      if (pose && data && pose.frameId === data.frameId) {
        if (!this.liveRobot) {
          this.liveRobot = new THREE.Mesh(
            new THREE.SphereGeometry(0.12),
            new THREE.MeshBasicMaterial({ color: '#087f9c', depthTest: false }),
          );
          this.liveRobot.renderOrder = 5;
          this.scene.add(this.liveRobot);
        }
        this.liveRobot.visible = true;
        this.liveRobot.position.set(pose.x, pose.y, pose.z + 0.1);
      } else if (this.liveRobot) this.liveRobot.visible = false;
    });
    effect(() => {
      const goal = this.state.goal();
      if (goal?.source === 'ros') {
        if (!this.liveGoal) {
          this.liveGoal = new THREE.Mesh(
            new THREE.RingGeometry(0.15, 0.21, 32),
            new THREE.MeshBasicMaterial({
              color: '#087f9c',
              side: THREE.DoubleSide,
              depthTest: false,
            }),
          );
          this.liveGoal.renderOrder = 6;
          this.scene.add(this.liveGoal);
        }
        this.liveGoal.visible = true;
        this.liveGoal.position.set(goal.x, goal.y, goal.z + 0.05);
      } else if (this.liveGoal) this.liveGoal.visible = false;
    });
    effect(() => {
      this.orbitCamera.zoom = this.state.zoom();
      this.orbitCamera.updateProjectionMatrix();
    });
  }

  private readonly wheel = (event: WheelEvent): void => {
    event.preventDefault();
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 800 : 1);
    this.zone.run(() => this.state.setZoom(this.state.zoom() * Math.exp(-delta * 0.001)));
  };

  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => {
      try {
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.domElement.style.display = 'block';
        this.viewport.nativeElement.appendChild(this.renderer.domElement);
        this.renderer.domElement.addEventListener('wheel', this.wheel, { passive: false });
        this.scene.background = new THREE.Color('#d3d4d1');
        this.orbitCamera.up.set(0, 0, 1);
        this.orbitCamera.position.set(15, -15, 15);
        this.configureControls();
        this.resizeObserver = new ResizeObserver(() => this.resize());
        this.resizeObserver.observe(this.viewport.nativeElement);
        this.resize();
        this.renderer.setAnimationLoop(() => {
          if (!this.isPointCloudView() || document.hidden) return;
          this.controls?.update();
          this.renderer?.render(this.scene, this.orbitCamera);
        });
        const data = this.state.ros.cloud();
        if (data) this.renderLiveCloud(data.positions);
        this.loadOfflinePointCloud();
      } catch {
        this.zone.run(() => this.message.set('WebGL is unavailable'));
      }
    });
  }

  private loadOfflinePointCloud(): void {
    new PCDLoader().load(
      '/assets/map/map.pcd',
      (cloud) => this.displayOfflinePointCloud(cloud),
      undefined,
      () => {
        if (!this.destroyed)
          this.zone.run(() => this.message.set('Map unavailable: /assets/map/map.pcd'));
      },
    );
  }

  private displayOfflinePointCloud(
    cloud: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>,
  ): void {
    if (this.destroyed) {
      this.disposeCloud(cloud);
      return;
    }
    this.offlineCloud = cloud;
    const geometry = cloud.geometry;
    geometry.computeBoundingBox();
    const bounds = geometry.boundingBox!;
    if (bounds.isEmpty()) {
      this.zone.run(() => this.message.set('Map contains no points'));
      return;
    }
    const height = Math.max(bounds.max.z - bounds.min.z, 0.001);
    const positions = geometry.getAttribute('position');
    const colors = new Float32Array(positions.count * 3);
    const color = new THREE.Color();
    const floorColor = new THREE.Color('#f5f5f0');
    const structureColor = new THREE.Color('#273336');
    const upperColor = new THREE.Color('#d8a2a5');
    for (let i = 0; i < positions.count; i++) {
      const value = (positions.getZ(i) - bounds.min.z) / height;
      if (value < 0.5) color.lerpColors(floorColor, structureColor, value * 2);
      else color.lerpColors(structureColor, upperColor, (value - 0.5) * 2);
      color.toArray(colors, i * 3);
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const size = bounds.getSize(new THREE.Vector3());
    this.extent = Math.max(size.x, size.y, size.z, 1) * 0.65;
    geometry.center();
    cloud.position.set(0, 0, 0);
    cloud.quaternion.identity();
    cloud.material.vertexColors = true;
    cloud.material.color.set(0xffffff);
    cloud.material.size = Math.max(this.extent / 350, 0.01);
    cloud.material.needsUpdate = true;
    this.scene.add(cloud);
    cloud.visible = this.state.ros.status() === 'demo';
    if (!cloud.visible) return;
    const far = this.extent * 100;
    this.orbitCamera.far = far;
    this.orbitCamera.position.set(this.extent * 1.8, -this.extent * 1.8, this.extent * 1.8);
    this.controls?.target.set(0, 0, 0);
    this.resize();
    this.zone.run(() => this.message.set(''));
  }

  floorPlanTransform(): string {
    const { x, y } = this.panOffset();
    return `translate(${x}px, ${y}px) scale(${this.state.zoom()})`;
  }

  zoomFloorPlan(event: WheelEvent): void {
    this.wheel(event);
  }

  startPan(event: PointerEvent): void {
    if (event.button !== 0 || !event.isPrimary) return;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    const offset = this.panOffset();
    this.panStart = {
      pointer: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      offsetX: offset.x,
      offsetY: offset.y,
    };
  }

  pan(event: PointerEvent): void {
    const start = this.panStart;
    if (!start || start.pointer !== event.pointerId) return;
    if (this.state.selectingGoal()) return;
    this.panOffset.set({
      x: start.offsetX + event.clientX - start.x,
      y: start.offsetY + event.clientY - start.y,
    });
  }

  endPan(event: PointerEvent): void {
    const start = this.panStart;
    if (start?.pointer !== event.pointerId) return;
    if (
      this.state.selectingGoal() &&
      event.type === 'pointerup' &&
      Math.hypot(event.clientX - start.x, event.clientY - start.y) < 5
    ) {
      const content = this.viewport.nativeElement.parentElement!.querySelector('.plan-content')!;
      const rect = content.getBoundingClientRect();
      const scale = Math.min(rect.width / FACILITY.width, rect.height / FACILITY.height);
      this.state.chooseDemoGoal({
        x: (event.clientX - rect.left - (rect.width - FACILITY.width * scale) / 2) / scale,
        y: (event.clientY - rect.top - (rect.height - FACILITY.height * scale) / 2) / scale,
      });
    }
    this.panStart = undefined;
  }

  resetView(): void {
    this.panOffset.set({ x: 0, y: 0 });
    this.state.setZoom(1);
    if (!this.controls) return;
    const bounds = this.liveCloud?.geometry.boundingBox ?? this.offlineCloud?.geometry.boundingBox;
    if (bounds) {
      this.fitBounds(bounds);
      return;
    }
    this.controls.target.set(0, 0, 0);
    this.orbitCamera.position.set(this.extent * 1.8, -this.extent * 1.8, this.extent * 1.8);
    this.controls.update();
  }

  routePoints(): string {
    return this.state
      .route()
      .map((p) => `${p.x},${p.y}`)
      .join(' ');
  }
  robotTransform(): string {
    const robot = this.state.robot();
    return `translate(${robot.x} ${robot.y}) rotate(${(robot.heading * 180) / Math.PI + 90})`;
  }
  scanPointerStart(event: PointerEvent): void {
    this.scanStart = { x: event.clientX, y: event.clientY };
  }
  pickLiveGoal(event: PointerEvent): void {
    if (
      !this.state.selectingGoal() ||
      !this.liveCloud ||
      event.button !== 0 ||
      Math.hypot(event.clientX - this.scanStart.x, event.clientY - this.scanStart.y) > 5
    )
      return;
    const rect = this.viewport.nativeElement.getBoundingClientRect();
    const ray = new THREE.Raycaster();
    ray.params.Points.threshold = this.extent / 60;
    ray.setFromCamera(
      new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        (-(event.clientY - rect.top) / rect.height) * 2 + 1,
      ),
      this.orbitCamera,
    );
    const hit = ray.intersectObject(this.liveCloud)[0];
    if (hit) this.state.chooseRosGoal(hit.point.x, hit.point.y, 0, this.state.ros.cloud()!.frameId);
    else this.state.notify('Click a visible point in the live map.');
  }
  private fitBounds(bounds: THREE.Box3): void {
    const center = bounds.getCenter(new THREE.Vector3()),
      size = bounds.getSize(new THREE.Vector3());
    this.extent = Math.max(size.x, size.y, size.z, 1) * 0.65;
    this.orbitCamera.far = this.extent * 100;
    this.orbitCamera.position
      .copy(center)
      .add(new THREE.Vector3(this.extent * 1.5, -this.extent * 1.5, this.extent * 1.5));
    this.controls?.target.copy(center);
    this.controls?.update();
    this.resize();
  }
  private renderLiveCloud(positions: Float32Array): void {
    if (this.liveCloud) {
      this.scene.remove(this.liveCloud);
      this.disposeCloud(this.liveCloud);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.computeBoundingBox();
    const bounds = geometry.boundingBox!;
    const height = Math.max(bounds.max.z - bounds.min.z, 0.001),
      colors = new Float32Array(positions.length);
    const low = new THREE.Color('#255568'),
      high = new THREE.Color('#db7d7d'),
      color = new THREE.Color();
    for (let i = 0; i < positions.length / 3; i++)
      color
        .lerpColors(low, high, (positions[i * 3 + 2] - bounds.min.z) / height)
        .toArray(colors, i * 3);
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const material = new THREE.PointsMaterial({
      size: Math.max(bounds.getSize(new THREE.Vector3()).length() / 300, 0.025),
      vertexColors: true,
    });
    this.liveCloud = new THREE.Points(geometry, material);
    this.scene.add(this.liveCloud);
    if (this.offlineCloud) this.offlineCloud.visible = false;
    if (!this.fittedLive) {
      this.fitBounds(bounds);
      this.fittedLive = true;
    }
  }

  private configureControls(): void {
    if (!this.renderer) return;
    const target = this.controls?.target.clone() ?? new THREE.Vector3();
    this.controls?.dispose();
    this.controls = new OrbitControls(this.orbitCamera, this.renderer.domElement);
    this.controls.target.copy(target);
    this.controls.enableDamping = true;
    this.controls.enableRotate = !this.state.selectingGoal();
    this.controls.enableZoom = false;
    this.controls.screenSpacePanning = true;
    this.controls.minZoom = 0.1;
    this.controls.maxZoom = 100;
    this.controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
    this.controls.touches.ONE = THREE.TOUCH.ROTATE;
    this.controls.update();
  }

  private resize(): void {
    const { clientWidth: width, clientHeight: height } = this.viewport.nativeElement;
    if (!width || !height || !this.renderer) return;
    const aspect = width / height;
    this.orbitCamera.aspect = aspect;
    this.orbitCamera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  private disposeCloud(cloud: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>): void {
    cloud.geometry.dispose();
    cloud.material.dispose();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.resizeObserver?.disconnect();
    this.controls?.dispose();
    this.renderer?.setAnimationLoop(null);
    this.renderer?.domElement.removeEventListener('wheel', this.wheel);
    if (this.offlineCloud) this.disposeCloud(this.offlineCloud);
    if (this.liveCloud) this.disposeCloud(this.liveCloud);
    this.liveRobot?.geometry.dispose();
    this.liveRobot?.material.dispose();
    this.liveGoal?.geometry.dispose();
    this.liveGoal?.material.dispose();
    this.scene.clear();
    this.renderer?.dispose();
    this.renderer?.domElement.remove();
  }
}
