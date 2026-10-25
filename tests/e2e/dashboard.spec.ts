import { test, expect, Page } from '@playwright/test';
async function floorPoint(page: Page, x: number, y: number) {
  const box = await page.locator('.plan-content').boundingBox();
  if (!box) throw new Error('Floor plan is missing');
  const scale = Math.min(box.width / 840, box.height / 580);
  await page.mouse.click(
    box.x + (box.width - 840 * scale) / 2 + x * scale,
    box.y + (box.height - 580 * scale) / 2 + y * scale,
  );
}
async function robot(page: Page) {
  return page.getByTestId('demo-robot').evaluate((e) => ({
    x: Number(e.getAttribute('data-x')),
    y: Number(e.getAttribute('data-y')),
  }));
}
test('Offline camera follows robot movement, stable views and sidebar-only 3D access', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('.floor-plan')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reset view', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '3D scan', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '3D Map View', exact: true }).click();
  await expect(page.locator('.viewport')).toBeVisible();
  await expect(page.getByText('Local PCD sample', { exact: true })).toBeVisible();
  await expect(page.locator('app-map-view p[role=status]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Map View', exact: true }).click();
  await expect(page.locator('.floor-plan')).toBeVisible();
  await page.getByRole('button', { name: 'Switch to camera view', exact: true }).click();
  const camera = page.getByRole('img', { name: 'Simulated offline robot camera' });
  await expect(camera).toBeVisible();
  const pixels = () => camera.evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
  const initial = await pixels();
  await page.waitForTimeout(300);
  expect(await pixels()).toBe(initial);
  await page.getByRole('button', { name: 'MANUAL', exact: true }).click();
  await page.keyboard.down('w');
  await expect.poll(pixels).not.toBe(initial);
  await page.keyboard.up('w');
  await page.getByRole('button', { name: 'Emergency stop', exact: true }).click();
  const stopped = await pixels();
  await page.waitForTimeout(400);
  expect(await pixels()).toBe(stopped);
  await expect(page.locator('.view-tab')).toContainText('Camera View');
  expect(errors).toEqual([]);
});
test('Demo goals reject obstacles, run, pause, resume, complete and stop', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'QUICK GOAL', exact: true }).click();
  await floorPoint(page, 340, 170);
  await expect(page.locator('.notice')).toContainText('open, reachable');
  await floorPoint(page, 550, 450);
  await expect(page.locator('.mission')).toContainText('Goal selected');
  await page.getByRole('button', { name: 'INITIATE', exact: true }).click();
  await expect(page.locator('.mission')).toContainText('On Mission');
  const start = await robot(page);
  await expect
    .poll(async () => Math.hypot((await robot(page)).x - start.x, (await robot(page)).y - start.y))
    .toBeGreaterThan(4);
  await page.getByRole('button', { name: 'Pause mission', exact: true }).click();
  const paused = await robot(page);
  await page.waitForTimeout(400);
  expect(await robot(page)).toEqual(paused);
  await page.getByRole('button', { name: 'Resume mission', exact: true }).click();
  await expect(page.locator('.mission')).toContainText('Mission complete', { timeout: 18000 });
  await page.getByRole('button', { name: 'QUICK GOAL', exact: true }).click();
  await floorPoint(page, 260, 440);
  await page.getByRole('button', { name: 'INITIATE', exact: true }).click();
  await page.getByRole('button', { name: 'Emergency stop', exact: true }).click();
  const stopped = await robot(page);
  await page.waitForTimeout(400);
  expect(await robot(page)).toEqual(stopped);
  await expect(page.locator('.mission')).toContainText('STOPPED');
  await page.getByRole('button', { name: 'Emergency stop', exact: true }).click();
  await page.getByRole('button', { name: 'MANUAL', exact: true }).click();
  const before = await robot(page);
  await page.keyboard.down('w');
  await page.waitForTimeout(600);
  await page.keyboard.up('w');
  expect(await robot(page)).not.toEqual(before);
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await page.getByRole('button', { name: 'Recenter map', exact: true }).click();
  await expect(page.locator('.zoom input')).toHaveValue('1');
});
test('ROS simulator: telemetry, commands, map-frame goals, stop and disconnect', async ({
  page,
  request,
}) => {
  await request.post('http://127.0.0.1:19090/reset');
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'QUICK GOAL', exact: true }).click();
  await floorPoint(page, 550, 450);
  await page.getByRole('button', { name: 'System and ROS settings', exact: true }).click();
  await page.getByLabel('ROS bridge URL').fill('ws://127.0.0.1:19090');
  await page.getByRole('button', { name: 'Connect ROS', exact: true }).click();
  await expect(page.locator('.bar')).toContainText('Online');
  await expect(page.locator('.notice')).toHaveCount(0);
  await expect(page.locator('.bar')).toContainText('87%');
  await expect(page.locator('.viewport')).toBeVisible();
  await expect(page.getByText('ROS point cloud', { exact: true })).toBeVisible();
  await expect(page.locator('.mission')).toContainText('Ready');
  await expect
    .poll(
      async () =>
        await page
          .locator('app-camera-view img')
          .evaluate((img: HTMLImageElement) => img.naturalWidth),
    )
    .toBe(640);
  const state = async () => await (await request.get('http://127.0.0.1:19090/state')).json();
  expect(
    (await state()).messages.some((m: any) => m.op === 'publish' && m.topic === '/goal_pose'),
  ).toBe(false);
  const cameraPixels = () =>
    page.locator('app-camera-view img').evaluate((img: HTMLImageElement) => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext('2d')!.drawImage(img, 0, 0);
      return canvas.toDataURL();
    });
  const initialCamera = await cameraPixels();
  await page.getByRole('button', { name: 'MANUAL', exact: true }).click();
  await page.keyboard.down('w');
  await page.waitForTimeout(300);
  await page.keyboard.up('w');
  await expect.poll(cameraPixels).not.toBe(initialCamera);
  expect(
    (await state()).messages.some((m: any) => m.topic === '/cmd_vel' && m.msg?.linear.x === 0.2),
  ).toBe(true);
  await page.getByRole('button', { name: 'AUTO', exact: true }).click();
  await page.getByRole('button', { name: 'QUICK GOAL', exact: true }).click();
  const box = await page.locator('.viewport').boundingBox();
  if (!box) throw new Error('3D map not visible');
  for (const [fx, fy] of [
    [0.5, 0.6],
    [0.55, 0.65],
    [0.45, 0.55],
  ]) {
    await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
    if ((await page.locator('.mission').innerText()).includes('Goal selected')) break;
  }
  await expect(page.locator('.mission')).toContainText('Goal selected');
  const cameraBeforeMission = await cameraPixels();
  await page.getByRole('button', { name: 'INITIATE', exact: true }).click();
  await expect
    .poll(async () =>
      (await state()).messages.some(
        (m: any) =>
          m.op === 'publish' && m.topic === '/goal_pose' && m.msg.header.frame_id === 'map',
      ),
    )
    .toBe(true);
  await expect(page.locator('.mission')).toContainText('On Mission');
  await expect.poll(cameraPixels).not.toBe(cameraBeforeMission);
  await page.getByRole('button', { name: 'Pause mission', exact: true }).click();
  await expect.poll(async () => (await state()).paused).toBe(true);
  await page.getByRole('button', { name: 'Resume mission', exact: true }).click();
  await expect.poll(async () => (await state()).paused).toBe(false);
  await page.getByRole('button', { name: 'Emergency stop', exact: true }).click();
  await expect.poll(async () => (await state()).stopped).toBe(true);
  await expect(page.getByRole('button', { name: 'Forward (W)', exact: true })).toBeDisabled();
  await request.post('http://127.0.0.1:19090/disconnect');
  await expect(page.locator('.bar')).toContainText('Offline');
  await expect(page.getByRole('button', { name: 'Forward (W)', exact: true })).toBeDisabled();
  expect(errors).toEqual([]);
});
test('Mobile: no overflow, hollow selected icons, keyboard-safe settings', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'MANUAL', exact: true }).click();
  await page.getByRole('button', { name: 'System and ROS settings', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByLabel('ROS bridge URL').fill('ws://localhost:9090/w');
  await expect(page.getByRole('button', { name: 'Forward (W)', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  const fill = await page
    .getByRole('button', { name: '3D Map View', exact: true })
    .locator('path')
    .evaluate((e) => getComputedStyle(e).fill);
  expect(fill).toBe('none');
});
