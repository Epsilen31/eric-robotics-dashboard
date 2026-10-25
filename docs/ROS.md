# ROS integration

## Configure the client

Use **System and ROS settings** in the sidebar, or edit `src/assets/ros-config.json` for default values. Opening settings does not connect automatically; click Connect ROS. A `?ros=ws://host:9090` URL explicitly connects on load. The client reconnects every three seconds after a lost connection. Switching to offline demo disconnects and releases image resources.

| Purpose          | Default topic               | ROS 2 type                        |
| ---------------- | --------------------------- | --------------------------------- |
| Point cloud      | `/points`                   | `sensor_msgs/msg/PointCloud2`     |
| Camera           | `/camera/image/compressed`  | `sensor_msgs/msg/CompressedImage` |
| Robot pose       | `/odom`                     | `nav_msgs/msg/Odometry`           |
| Battery          | `/battery_state`            | `sensor_msgs/msg/BatteryState`    |
| Manual motion    | `/cmd_vel`                  | `geometry_msgs/msg/Twist`         |
| Navigation goal  | `/goal_pose`                | `geometry_msgs/msg/PoseStamped`   |
| Software stop    | `/dashboard/stop`           | `std_msgs/msg/Bool`               |
| Pause/resume     | `/dashboard/pause`          | `std_msgs/msg/Bool`               |
| Mission feedback | `/dashboard/mission_status` | `std_msgs/msg/String`             |

The default goal frame is `map`. Goal and sensor topic names are editable. Use WSS for an HTTPS-hosted dashboard. Demo configuration connects only to local services; no cloud credentials are needed.

## Local simulator

```sh
npm run ros:demo
```

Connect to `ws://127.0.0.1:9090`. This Node.js server implements the subset of rosbridge JSON needed by the dashboard; it is **not a ROS installation**. It sends a synthetic warehouse cloud, a generated PNG camera image, map-frame odometry and an 87% battery reading. It supports manual input, straight-line goal motion, mission feedback, pause/resume and software stop. It does not simulate physical dynamics or autonomous obstacle avoidance. Offline floor-plan missions use the separate grid planner.

The mock is bound to 127.0.0.1. Its `/health`, `/state`, POST `/reset` and POST `/disconnect` endpoints support automated local validation. Do not use the mock server as a physical robot controller.

## Real ROS 2 / bag playback

On a machine with ROS 2 and rosbridge_server installed:

```sh
ros2 launch rosbridge_server rosbridge_websocket_launch.xml
```

Start your robot stack or replay your recording in another terminal:

```sh
ros2 bag play /path/to/recording --loop
```

Connect the dashboard to that machine's rosbridge WebSocket address. Set the cloud, compressed-camera, pose and battery topic names to those present in the recording. The browser expects JPEG/PNG CompressedImage data; raw Image streams need an upstream compressor. XYZ fields must be float32 or float64. Frames must be aligned upstream: this client does not resolve TF. Pose markers are hidden for unmatched frames, and a goal cannot be sent when the configured goal frame differs from the cloud frame.

A bag replays sensor data; it does not by itself provide a controller that responds to new velocity/goal commands. For interactive navigation, run the navigation stack or an adapter implementing the contract below. A static publisher may need compatible ROS QoS/republishing so a newly connected bridge subscriber receives its data.

## Navigation adapter contract

The client publishes PoseStamped destinations to the configured goal topic. Your controller must consume that topic or forward it to the navigation action used by your stack (for example Nav2's NavigateToPose). Publishing a topic alone does not establish an action connection.

- Stop `true`: cancel navigation, stop velocity and latch the software stop.
- Stop `false`: release the software stop; do not automatically replay an old goal.
- Pause `true`: pause/cancel the current navigation request while retaining its destination if supported.
- Pause `false`: resume the retained destination if supported.
- Mission feedback: publish `active`, `paused`, `completed` or `stopped` as String messages. The dashboard displays submitted state until feedback arrives. The mock implements this contract.
- Apply command arbitration and an independent velocity watchdog. A zero Twist from the browser is not a hardware emergency stop.

The client never sends periodic zero commands in AUTO. In MANUAL, Twist is published at 10 Hz, with zero on release, mode change, pause, stop or window blur. Reconnect clears the held-input state and earlier destination. ROS goals require a cloud received within the last ten seconds.

## Primary references

- [rosbridge JSON protocol](https://github.com/RobotWebTools/rosbridge_suite/blob/ros2/ROSBRIDGE_PROTOCOL.md)
- [ROS sensor message definitions](https://github.com/ros2/common_interfaces/tree/rolling/sensor_msgs/msg)
- [ROS 2 recording and playback](https://docs.ros.org/en/humble/Tutorials/Beginner-CLI-Tools/Recording-And-Playing-Back-Data/Recording-And-Playing-Back-Data.html)

No physical robot, bridge endpoint or ROS bag was supplied for this assignment. Transport and controller interactions were validated against the included simulator; real hardware validation remains external work.
