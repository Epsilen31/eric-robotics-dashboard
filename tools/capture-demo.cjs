const { chromium } = require('@playwright/test');
const { browserOptions } = require('./browser.cjs');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs/promises');
async function waitFor(url) {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw Error(`Server unavailable: ${url}`);
}
(async () => {
  const children = [];
  let browser, context;
  try {
    await fs.mkdir('docs/demo', { recursive: true });
    await fs.mkdir('docs/screenshots', { recursive: true });
    for (const [script, port] of [
      ['tools/serve-built.cjs', '14202'],
      ['tools/mock-ros.cjs', '19091'],
    ]) {
      const child = spawn(process.execPath, [script, '--port', port], {
        windowsHide: true,
        stdio: 'pipe',
      });
      children.push(child);
      child.stderr.on('data', (d) => process.stderr.write(d));
      child.stdout.on('data', () => {});
    }
    await waitFor('http://127.0.0.1:14202');
    await waitFor('http://127.0.0.1:19091/health');
    browser = await chromium.launch(browserOptions());
    context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      recordVideo: { dir: 'docs/demo', size: { width: 1280, height: 800 } },
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('http://127.0.0.1:14202');
    await page.waitForFunction(() => document.querySelector('video')?.currentTime > 0.5);
    await page.screenshot({ path: 'docs/screenshots/floor-plan.png' });
    await page.getByRole('button', { name: 'QUICK GOAL', exact: true }).click();
    const box = await page.locator('.plan-content').boundingBox(),
      scale = Math.min(box.width / 840, box.height / 580);
    await page.mouse.click(
      box.x + (box.width - 840 * scale) / 2 + 550 * scale,
      box.y + (box.height - 580 * scale) / 2 + 450 * scale,
    );
    await page.getByRole('button', { name: 'INITIATE', exact: true }).click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'docs/screenshots/mission.png' });
    await page.getByRole('button', { name: '3D Map View', exact: true }).click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: 'docs/screenshots/3d-map.png' });
    await page.getByRole('button', { name: 'System and ROS settings', exact: true }).click();
    await page.getByLabel('ROS bridge URL').fill('ws://127.0.0.1:19091');
    await page.getByRole('button', { name: 'Connect ROS', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.bar')?.textContent.includes('87%'));
    await page.waitForTimeout(600);
    await page.screenshot({ path: 'docs/screenshots/ros-map.png' });
    await page.getByRole('button', { name: 'Switch to camera view', exact: true }).click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'docs/screenshots/ros-camera.png' });
    await page.goto('http://127.0.0.1:14202');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(700);
    await page.screenshot({ path: 'docs/screenshots/mobile.png' });
    if (errors.length) throw Error(errors.join('; '));
    const video = page.video();
    await context.close();
    context = null;
    const source = await video.path();
    await fs.rename(source, path.resolve('docs/demo/dashboard.webm'));
    console.log('Captured actual desktop/mobile screenshots and docs/demo/dashboard.webm.');
  } finally {
    if (context) await context.close();
    if (browser) await browser.close();
    for (const child of children) child.kill();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
