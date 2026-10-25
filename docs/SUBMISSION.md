# Submission checklist

| Requirement                      | Evidence / status                                                                                                                 |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Modern frontend framework        | Angular 19 standalone components and Nx                                                                                           |
| Reference layout and interaction | Sidebar, mission/mode/status controls, emergency stop, joystick, PiP swap; approved UI refinements retained                       |
| Responsive UI                    | Desktop rail, mobile bottom bar, screenshots and browser tests                                                                    |
| Camera view                      | Pose-linked offline simulation and ROS CompressedImage feed; bundled MP4 retained as a sample                                     |
| 3D map                           | Real bundled PCD available through sidebar; live PointCloud2 support                                                              |
| Local self-hosting               | `npm start`, `npm run build`, `npm run serve:built`                                                                               |
| Offline runtime                  | Local assets and framework bundle; no required CDN or Nx Cloud                                                                    |
| Modular code                     | Shared state/ROS services, isolated overlays/views, decoder and demo planner                                                      |
| ROS integration                  | Configurable protocol client, real sensor message types, runnable local simulator; physical hardware not tested                   |
| Setup / architecture explanation | Root README, ARCHITECTURE.md, ROS.md, asset provenance                                                                            |
| Images and video                 | docs/screenshots and docs/demo/dashboard.webm; regenerated from the built implementation                                          |
| Progressive commits              | Original Git history deleted by the owner; completed source reintroduced in logical batches, not a recreated development timeline |
| Public GitHub repository         | [Epsilen31/eric-robotics-dashboard](https://github.com/Epsilen31/eric-robotics-dashboard)                                         |
| Three-day deadline               | Confirm against the actual acceptance date before submission                                                                      |

Before pushing, inspect the captured video/images, verify `npm ci`, `npm run test:unit`, `npm run test:e2e`, `npm run format:check` and `npm run build`, then choose the public repository. Do not add node_modules, generated build output, secrets, local IDE settings or test traces. Framework/tooling audit findings should be reviewed before any production deployment.

The source does not contain the original factory recording or matching scan. The supplied illustrative floor plan, PCL office scan and Sintel video are independent samples, with provenance documented in `src/assets/README.md`. The synthetic ROS source is explicitly a local simulator. Do not claim exact factory data, hardware tests, ROS bag playback tests, or GitHub publication that have not occurred.
