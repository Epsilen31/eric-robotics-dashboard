# Validation record

Checked on 25 October 2026 with Node.js 22.14 and installed Microsoft Edge on Windows.

| Check                                             | Result                                                                                       |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `npm run test:unit`                               | 5 passed: point-cloud decoding/limits, byte boundaries and demo planning                     |
| `npm run test:e2e`                                | 4 passed: offline camera movement/3D access, demo mission lifecycle, ROS workflow, mobile UI |
| Targeted ROS/mobile regression after final polish | 2 passed                                                                                     |
| `npm run format:check`                            | Passed                                                                                       |
| `npm run build`                                   | Passed; existing initial-bundle warning, approximately 790 kB raw total                      |
| Recorded demo artifacts                           | Actual production screenshots and WebM generated using local mock ROS                        |
| Browser runtime errors                            | None in checked workflows                                                                    |

The ROS check uses a real local WebSocket server. It verifies PointCloud2 subscriptions, compressed PNG decoding, received pose/battery data, Twist publication, map-frame goals, pause/resume, software stop and disconnect state. Earlier demo goals are cleared when switching data sources. The offline mission test checks obstacle rejection, visible movement, pausing, completion, stop and manual input.

The checked production output is served locally with byte-range video support. Capture runs do not depend on the long-running development server. Screenshots were visually reviewed for label readability, emergency-ring clearance, hollow sidebar icons and mobile overlap.

This record does not claim physical robot testing, real ROS bag playback, TF transforms, Nav2 action integration or exact factory media. Those need the target data and robot stack. The local server is a protocol simulator, not an actual ROS node graph.

Existing framework/tooling dependency audit findings remain documented in the README. Breaking upgrades were not applied. The owner deleted the original Git history before publication. Replacement commits group the completed source into logical batches and do not reproduce the original timeline.

## Editor/analyzer cleanup

ROS defaults now load through an explicit Angular app initializer rather than a service constructor. Packet parsing, typed sensor handlers and demo simulation steps are separate methods. Binary decoding uses a shared codePointAt-based byte conversion, with boundary-byte coverage.

All three TypeScript project checks and the Angular production build pass. Unused standalone imports are configured as compiler errors; the sidebar and connection panel are both used and pass that check. Cached Angular Language Service messages may need VS Code's Developer: Reload Window command.

Control text contrast was checked at 10.76:1 for pad labels, 6.59:1 for pressed controls and 6.36:1 for the hub label. TypeScript JSON schemas are vendored with their upstream license and referenced locally; validation no longer depends on SchemaStore DNS.

## Code organization cleanup

Domain models, constants, binary utilities and offline demo logic are separated under `core/`. Component markup/styles live beside their TypeScript controllers. Numeric sidebar dispatch and unused orthographic-camera/toggle code were removed. ROS reconnect scheduling is shared, and form input handlers use checked DOM types instead of template `any` casts. The production build, five unit tests and four browser workflows are rerun after this refactor.
