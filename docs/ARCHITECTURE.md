# Architecture and approach

The UI uses standalone Angular components, signals for shared state, and local SCSS. The reference's mission/status pills, mode switch, circular emergency control, joystick, sidebar and picture-in-picture view are kept as separate components. Responsive breakpoints preserve the desktop rail and switch to bottom navigation on phones. Emergency labels are drawn on the yellow ring in a single SVG; only the dashboard icon is filled when selected, so outlined icons retain their shape.

## Data and state

`DashboardStateService` owns the selected view, map mode, operating mode, stop/pause state, destination, demo pose, route and mission lifecycle. QUICK GOAL validates a destination; INITIATE starts a local demo route or publishes a goal from the current live map. A 10 Hz tick runs local motion and manual ROS input. AUTO never sends a periodic stream of zero velocity that would compete with a navigation controller.

`core/demo/facility.ts` contains the labelled demo layout's walkable boundaries and a grid-search planner. It excludes rooms/racks and includes a clearance margin. This is a small illustrative planner, not a replacement for ROS navigation. The SVG background stays fixed while an SVG overlay draws the moving robot, selected destination and remaining route. Image and overlay share a view box, so hit testing still works after zoom, pan and resizing.

`RosService` implements the JSON rosbridge WebSocket operations used by this dashboard: subscribe, advertise and publish. Topics and frame IDs come from `src/assets/ros-config.json` or the settings dialog. It subscribes to real PointCloud2, CompressedImage, Odometry, BatteryState and adapter mission feedback. Compressed camera images use bounded, revoked Blob URLs. Point clouds use a bounded decoder with support for float32/float64 XYZ, field offsets, organized row padding, NaN filtering and either byte order.

## Map and camera rendering

The floor plan remains the default readable demo. The sidebar's 3D action opens a Three.js scene. PCDLoader loads the bundled sample asynchronously. Orbit controls, wheel zoom and recentering are available without the removed floating toolbar. Live ROS clouds retain their original coordinates; centering the local PCD is a display-only operation. Live pose markers appear only when their frame matches the point cloud.

ROS goals are selected by raycasting the live cloud, with navigation Z fixed to zero. The configured goal frame must match the cloud frame, and a fresh cloud and active connection are required. Demo SVG coordinates are never published as robot goals. No TF transform is applied in the browser.

The camera component renders a labelled first-person simulation from the offline robot pose and shared walkable geometry. It switches to received CompressedImage frames when a ROS connection is selected; it does not silently substitute the sample clip for a missing live stream.

## Lifecycle and recovery

Both views stay mounted during picture-in-picture swaps. Source changes clear earlier destinations and routes. Disconnects disable manual input and interrupt the UI mission; reconnects do not replay held keys or old goals and require fresh live data. Switching away from selection cancels selection. Window blur clears held inputs. Three.js geometries/materials, resize observers, controls, timers, sockets and image URLs are released during cleanup.

The software stop publishes zero velocity plus the configured stop Boolean. A real navigation controller must honor that stop topic, cancel its active goal and enforce its own watchdog. The mock does this locally. Bridge connectivity is reported separately from unavailable battery telemetry; no hardware failsafe state is invented.

## Validation

Tests use actual local WebSockets, not a replacement browser WebSocket implementation. The simulator provides repeatable point clouds, encoded PNG images, pose/battery feedback and command consumption. It is explicitly synthetic. Browser tests also check the offline camera, mission lifecycle, 3D access, sidebar state and mobile layout. Screenshots and the WebM recording from the built application are included in `docs/screenshots/` and `docs/demo/`.

## Code organization and naming

- `core/models/`: geometry, navigation state and ROS message contracts. String union types describe dashboard states; enums identify sidebar actions and ROS point-field data types.
- `core/constants/`: shared movement/zoom settings, mission labels, facility geometry, ROS defaults and payload limits.
- `core/demo/`: offline route planning and camera rendering, both using the same facility geometry.
- `core/utils/`: pure Base64 and PointCloud2 decoding.
- `core/dashboard-state.service.ts`: dashboard actions, mission lifecycle and movement scheduling.
- `core/ros.service.ts`: connection lifecycle and ROS publications. Command methods use explicit names such as `publishVelocity`, `publishGoal` and `publishStop`.
- `layout/`, `overlays/`, `views/`: feature components with adjacent HTML and SCSS. Sidebar and drive-control definitions stay beside the components that own them.

Runtime ROS defaults remain editable in `src/assets/ros-config.json`; built-in defaults provide an offline fallback if that optional asset cannot load. TypeScript checks unused locals and parameters, while Angular checks unused standalone imports and templates. Preserve protocol field names such as `point_step` and `frame_id`, because these come from ROS messages.
