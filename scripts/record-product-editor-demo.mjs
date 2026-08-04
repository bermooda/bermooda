#!/usr/bin/env node
/**
 * Records a short demo of the admin product two-column editor.
 *
 * Usage:
 *   npx playwright install chromium
 *   PORT=3000 npx react-router dev --host   # separate terminal
 *   npm run seed
 *   node scripts/record-product-editor-demo.mjs
 */
import { execSync } from 'node:child_process';
import { copyFile, mkdir, readdir, rename } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

const BASE = process.env.DEMO_BASE_URL ?? 'http://localhost:3000';
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@bermooda.dev';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'changeme123!';
const PRODUCT_ID = process.env.DEMO_PRODUCT_ID ?? 'seed-demo-product';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.resolve(__dirname, '../artifacts/product-editor-demo');
const artifactDir = '/opt/cursor/artifacts';

function clearStaleVerifications() {
  execSync(`sqlite3 prisma/dev.db "DELETE FROM Verification;"`, {
    cwd: path.resolve(__dirname, '..'),
  });
}

function fetchLatestOtp() {
  const row = execSync(
    `sqlite3 prisma/dev.db "SELECT value FROM Verification WHERE identifier LIKE '2fa-otp-%' ORDER BY createdAt DESC LIMIT 1;"`,
    { cwd: path.resolve(__dirname, '..'), encoding: 'utf8' }
  ).trim();
  return row.split(':')[0] ?? '';
}

/**
 * @param {import('playwright').Page} page
 */
async function login(page) {
  clearStaleVerifications();
  await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });

  await page.locator('#email').waitFor({ state: 'visible', timeout: 15000 });
  await page.locator('#email').fill(ADMIN_EMAIL);
  await page.locator('#password').fill(ADMIN_PASSWORD);
  await page.locator('button[type="submit"]').click();

  await page.waitForURL(/\/admin\/(dashboard|verify-2fa)/, {
    timeout: 30000,
  });

  if (page.url().includes('/admin/verify-2fa')) {
    await page.waitForTimeout(1500);
    const otp = fetchLatestOtp();
    if (!/^\d{6}$/.test(otp)) {
      throw new Error(`Expected 6-digit OTP, got: ${JSON.stringify(otp)}`);
    }
    await page.locator('#otp-0').click();
    await page.locator('#otp-0').pressSequentially(otp, { delay: 40 });
    await page.locator('button[type="submit"]').first().click();
    await page.waitForURL(/\/admin\/(?!verify-2fa)/, { timeout: 20000 });
  }
}

/**
 * @param {import('playwright').Page} page
 * @param {number} [ms]
 */
async function pause(page, ms = 1200) {
  await page.waitForTimeout(ms);
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  await mkdir(artifactDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: {
      dir: outputDir,
      size: { width: 1440, height: 900 },
    },
  });
  const page = await context.newPage();

  await login(page);
  await pause(page, 800);

  await page.goto(`${BASE}/admin/products`, { waitUntil: 'networkidle' });
  await pause(page, 1600);

  await page.goto(`${BASE}/admin/products/${PRODUCT_ID}`, {
    waitUntil: 'networkidle',
  });
  await page.locator('#product-editor-form').waitFor({
    state: 'visible',
    timeout: 15000,
  });
  await pause(page, 1800);

  const sections = page.locator('#product-editor-form h2');
  const count = await sections.count();
  for (let i = 0; i < count; i++) {
    await sections.nth(i).scrollIntoViewIfNeeded();
    await pause(page, 1000);
  }

  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await pause(page, 1200);

  const titleInput = page
    .locator('input[name^="translation"][name$="[title]"]')
    .first();
  if (await titleInput.isVisible().catch(() => false)) {
    await titleInput.click();
    await pause(page, 700);
  }

  await page
    .locator('button[form="product-editor-form"]')
    .first()
    .scrollIntoViewIfNeeded();
  await pause(page, 1600);

  const videoPath = await page.video()?.path();
  await context.close();
  await browser.close();

  const files = await readdir(outputDir);
  const webm = files.find((f) => f.endsWith('.webm'));
  if (!webm && !videoPath) {
    throw new Error('No demo video recorded');
  }

  const src = videoPath ?? path.join(outputDir, webm);
  const webmDest = path.join(outputDir, 'product-editor-two-column-demo.webm');
  if (path.resolve(src) !== path.resolve(webmDest)) {
    try {
      await rename(src, webmDest);
    } catch {
      await copyFile(src, webmDest);
    }
  }

  // Cursor / GitHub playback expects H.264 MP4 rather than Playwright's VP8 WebM.
  const destName = 'product-editor-two-column-demo.mp4';
  const dest = path.join(outputDir, destName);
  execSync(
    `ffmpeg -y -i ${JSON.stringify(webmDest)} -c:v libx264 -pix_fmt yuv420p -movflags +faststart ${JSON.stringify(dest)}`,
    { stdio: 'inherit' }
  );

  const publicArtifact = path.join(artifactDir, destName);
  await copyFile(dest, publicArtifact);

  console.log(`Demo video saved to ${dest}`);
  console.log(`Artifact copy: ${publicArtifact}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
