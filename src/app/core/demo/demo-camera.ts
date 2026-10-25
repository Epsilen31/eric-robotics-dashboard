import { isWalkable } from './facility';
import type { RobotPose2D } from '../models/geometry.model';

export function renderDemoCamera(canvas: HTMLCanvasElement, pose: RobotPose2D): void {
  const context = canvas.getContext('2d');
  if (!context) return;
  const width = canvas.width;
  const height = canvas.height;
  const horizon = height / 2;
  const focal = width / 1.4;
  const image = context.createImageData(width, height);
  for (let x = 0; x < width; x++) {
    const side = ((x + 0.5) / width - 0.5) * 1.4;
    const dx = Math.cos(pose.heading) - Math.sin(pose.heading) * side;
    const dy = Math.sin(pose.heading) + Math.cos(pose.heading) * side;
    let distance = 2;
    while (distance < 1200 && isWalkable({ x: pose.x + dx * distance, y: pose.y + dy * distance }))
      distance += 2;
    const top = horizon - (45 * focal) / distance;
    const bottom = horizon + (24 * focal) / distance;
    const hitX = pose.x + dx * distance;
    const hitY = pose.y + dy * distance;
    for (let y = 0; y < height; y++) {
      let rgb = [125, 143, 151];
      if (y >= top && y <= bottom) {
        const verticalRail =
          Math.abs(hitX / 32 - Math.round(hitX / 32)) < 0.07 ||
          Math.abs(hitY / 32 - Math.round(hitY / 32)) < 0.07;
        const horizontalRail = (((y - top) / (bottom - top)) * 3) % 1 < 0.07;
        rgb = verticalRail || horizontalRail ? [235, 202, 33] : [54, 76, 85];
      } else if (y > horizon) {
        const depth = (24 * focal) / (y - horizon);
        const floorX = (pose.x + dx * depth) / 40;
        const floorY = (pose.y + dy * depth) / 40;
        const grid =
          Math.abs(floorX - Math.round(floorX)) < 0.025 ||
          Math.abs(floorY - Math.round(floorY)) < 0.025;
        rgb = grid ? [125, 139, 137] : [184, 187, 178];
      }
      const offset = (y * width + x) * 4;
      image.data.set([...rgb, 255], offset);
    }
  }
  context.putImageData(image, 0, 0);
}
