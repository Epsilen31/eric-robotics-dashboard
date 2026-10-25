# Insight.IO robotics dashboard

## Submitted by

- **Full Name:** Abhishek Mishra
- **Contact Number:** 8758114688
- **Email ID:** abhishekmishra242831@gmail.com

An Angular 19 dashboard built for the Insight.IO UI assignment. It includes camera and map views, a mission panel, manual driving controls, and a ROS bridge connection. Three.js handles the 3D point clouds; Nx runs the development server and builds.

![Dashboard](docs/screenshots/floor-plan.png)

[Offline camera](docs/screenshots/offline-camera.png) | [3D map](docs/screenshots/3d-map.png) | [ROS camera](docs/screenshots/ros-camera.png) | [Mobile layout](docs/screenshots/mobile.png) | [Demo video](docs/demo/dashboard.webm)

The screenshots and demo video show the current production build, including the offline camera simulation, mission controls, ROS demo, and mobile layout.

## Run the app

Requirements: Node.js 22.14 or newer and npm. Development and testing were done on Windows with Node.js 22.14.

```sh
git clone https://github.com/Epsilen31/eric-robotics-dashboard.git
cd eric-robotics-dashboard
npm ci
npm start
```

Open http://localhost:4200. Use `npm start` rather than `ng serve`: this project uses an Nx workspace with `project.json`.

Installing dependencies needs internet. Once installed, the app and its local demos run without an internet connection.

## Try the offline demo

The app starts with a floor plan and a simulated robot.

1. Click **QUICK GOAL** and select an open area on the floor plan.
2. Select **AUTO**, then **INITIATE**. The robot follows the route to the destination.
3. Use the mission button to pause or resume. **Emergency stop** stops movement and clears the route. Release the stop before starting another mission.
4. For manual control, select **MANUAL**. Hold W/S to move forward/backward and A/D to turn, or use the direction pad. Releasing the controls or moving focus away from the window stops manual input.

Click the small preview to switch between map and camera. The offline camera is a simulated view of the floor plan: it changes as the robot moves or turns. It is labelled **LOCAL SIMULATION**.

Use the sidebar to open the camera, floor plan, quick-goal selection, 3D map, recenter action, or ROS settings. The 3D map loads a bundled PCD scan. Scroll or use the zoom controls to zoom; drag to pan the floor plan or orbit the 3D map.

## Connect to the local ROS demo

Keep the app running and open another terminal:

```sh
npm run ros:demo
```

Open **System and ROS settings** from the sidebar. Set the bridge URL to `ws://127.0.0.1:9090` and click **Connect ROS**.

The demo sends point clouds, camera images, robot pose, battery level, and mission updates over WebSocket. The camera changes with the robot's position and direction. AUTO goals, manual controls, pause, and stop work with this server.

This is a Node.js simulator of the rosbridge protocol, not a running ROS installation. Its robot moves directly toward goals without planning around obstacles. The offline floor-plan demo uses a separate route planner.

If port 9090 is already occupied, connect to the existing demo or start another on a different port:

```sh
npm run ros:demo -- --port 9091
```

For that command, use `ws://127.0.0.1:9091` in settings. Restart the demo server after changing its code. Select **Use offline demo** to disconnect.

For an actual ROS bridge, topic configuration, and bag playback instructions, see [ROS integration](docs/ROS.md). Real robot navigation needs a controller that handles the goal, pause, and stop topics and returns mission feedback.

## Build and serve

```sh
npm run build
npm run serve:built
```

Open http://127.0.0.1:4202. The build output is in `dist/insight-io/browser` and can also be hosted with another static server.

## Tests

```sh
npm run test:unit
npm run test:e2e
npm run format:check
```

Unit tests check point-cloud decoding, byte conversion, payload limits, and route planning. Playwright tests run the app in a browser and check view switching, robot movement, mission controls, ROS data and commands, and the mobile layout. The browser tests start local servers on ports 4201 and 19090; they may reuse servers already running on those ports, so stop stale test servers after code changes.

On Windows, the tests use Microsoft Edge if it is found in the expected installation directory. Otherwise, install Playwright's Chromium browser:

```sh
npx playwright install chromium
```

The browser download needs internet. The tests themselves use local services.

## Screenshots and video

Screenshots are included in `docs/screenshots/`, and the demo video is at `docs/demo/dashboard.webm`. Open the links at the top of this README to view them.

## Project structure

- `src/app/core/models/`: geometry, navigation, and ROS message types.
- `src/app/core/constants/`: configuration, movement settings, and data limits.
- `src/app/core/demo/`: offline route planning and camera rendering.
- `src/app/core/utils/`: byte and point-cloud decoding.
- `src/app/core/`: dashboard state and ROS connection services.
- `src/app/layout/`, `overlays/`, `views/`: components with their HTML and SCSS.
- `tools/`: ROS simulator, static server, and browser configuration.
- `tests/`: unit and browser tests.

[Architecture](docs/ARCHITECTURE.md) | [Asset sources and licenses](src/assets/README.md) | [Validation notes](docs/VALIDATION.md) | [Submission checklist](docs/SUBMISSION.md)

## Known limitations

- The original factory video and matching map were not supplied. The floor plan, PCD scan, and ROS demo are separate sample environments. The bundled Sintel video is retained as a sample asset; the offline camera uses the simulation instead.
- ROS communication has been tested with the local protocol simulator. Physical robot operation, actual ROS bag playback, TF transforms, and Nav2 action integration have not been tested.
- The emergency button sends a software stop. A physical robot needs its own safety controls.
- The production build passes with an initial bundle-size warning of about 794 kB against a 500 kB warning budget. Dependency audit findings in the framework/tooling stack remain unresolved.
- The original Git history was deleted before publication. The current commits group the completed code into batches rather than reproduce its development timeline.
