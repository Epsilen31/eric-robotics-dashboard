import type { Position2D } from '../models/geometry.model';
import {
  FACILITY,
  FACILITY_OBSTACLES,
  ROUTE_GRID_SIZE,
  ROBOT_CLEARANCE,
} from '../constants/facility.constants';
export function isWalkable(position: Position2D): boolean {
  return (
    Number.isFinite(position.x) &&
    Number.isFinite(position.y) &&
    position.x >= 48 &&
    position.x <= FACILITY.width - 48 &&
    position.y >= 46 &&
    position.y <= FACILITY.height - 54 &&
    !FACILITY_OBSTACLES.some(
      ([left, top, right, bottom]) =>
        position.x >= left - ROBOT_CLEARANCE &&
        position.x <= right + ROBOT_CLEARANCE &&
        position.y >= top - ROBOT_CLEARANCE &&
        position.y <= bottom + ROBOT_CLEARANCE,
    )
  );
}

export function planDemoRoute(start: Position2D, goal: Position2D): Position2D[] | null {
  if (!isWalkable(start) || !isWalkable(goal)) return null;
  const toGridCell = (position: Position2D): [number, number] => [
    Math.floor(position.x / ROUTE_GRID_SIZE),
    Math.floor(position.y / ROUTE_GRID_SIZE),
  ];
  const cellKey = (x: number, y: number) => `${x},${y}`;
  const [startColumn, startRow] = toGridCell(start),
    [goalColumn, goalRow] = toGridCell(goal);
  const queue: [number, number][] = [[startColumn, startRow]];
  const parents = new Map<string, string | null>([[cellKey(startColumn, startRow), null]]);
  let found = false;

  for (const [x, y] of queue) {
    if (x === goalColumn && y === goalRow) {
      found = true;
      break;
    }
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nextColumn = x + dx,
        nextRow = y + dy,
        next = cellKey(nextColumn, nextRow);
      if (
        parents.has(next) ||
        !isWalkable({
          x: nextColumn * ROUTE_GRID_SIZE + ROUTE_GRID_SIZE / 2,
          y: nextRow * ROUTE_GRID_SIZE + ROUTE_GRID_SIZE / 2,
        })
      )
        continue;
      parents.set(next, cellKey(x, y));
      queue.push([nextColumn, nextRow]);
    }
  }
  if (!found) return null;
  const route: Position2D[] = [goal];
  let cursor: string | null = cellKey(goalColumn, goalRow);
  while (cursor !== null) {
    const [x, y] = cursor.split(',').map(Number);
    route.push({
      x: x * ROUTE_GRID_SIZE + ROUTE_GRID_SIZE / 2,
      y: y * ROUTE_GRID_SIZE + ROUTE_GRID_SIZE / 2,
    });
    cursor = parents.get(cursor) ?? null;
  }
  route.push(start);
  return route.reverse();
}
