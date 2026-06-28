#!/usr/bin/env node
/**
 * Records a short demo video of the updated admin list/detail views.
 *
 * Usage:
 *   npx playwright install chromium
 *   npx react-router dev --port 3000 --host   # separate terminal
 *   npm run seed
 *   node scripts/record-admin-design-demo.mjs
 */
import { execSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

const BASE = process.env.DEMO_BASE_URL ?? 'http://localhost:3000';
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@bermooda.dev';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'changeme123!';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.resolve(__dirname, '../artifacts/admin-design-demo');

function fetchLatestOtp() {
  const row = execSync(
    `sqlite3 prisma/dev.db "SELECT value FROM Verification WHERE identifier LIKE '2fa-otp-%' ORDER BY createdAt DESC LIMIT 1;"`,
    { cwd: path.resolve(__dirname, '..'), encoding: 'utf8' }
  ).trim();
  return row.split(':')[0] ?? '';
}

async function login(page) {
  await page.goto(`${BASE}/admin`);
  await page.waitForLoadState('networkidle');

  const emailInput = page.locator('#email');
  await emailInput.waitFor({ state: 'visible', timeout: 10000 });
  await emailInput.fill(ADMIN_EMAIL);
  await page.locator('#password').fill(ADMIN_PASSWORD);
  await page.locator('button[type="submit"]').click();

  await page.waitForURL(/\/admin\/(dashboard|verify-2fa)/, {
    timeout: 30000,
  });

  if (page.url().includes('/admin/verify-2fa')) {
    await page.waitForTimeout(2000);
    const otp = fetchLatestOtp();
    const firstOtp = page.locator('#otp-0');
    await firstOtp.click();
    await page.evaluate(async (code) => {
      await navigator.clipboard.writeText(code);
    }, otp);
    await firstOtp.press('ControlOrMeta+v');
    await page.locator('button[type="submit"]').first().click();
    await page.waitForURL(/\/admin\/dashboard/, { timeout: 15000 });
  }
}

async function pause(page, ms = 1200) {
  await page.waitForTimeout(ms);
}

async function main() {
  await mkdir(outputDir, { recursive: true });

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

  const routes = [
    { name: 'Products (reference)', path: '/admin/products' },
    { name: 'Pages', path: '/admin/pages' },
    { name: 'Orders', path: '/admin/orders' },
    { name: 'Customers', path: '/admin/customers' },
  ];

  for (const route of routes) {
    await page.goto(`${BASE}${route.path}`);
    await page.waitForLoadState('networkidle');
    await pause(page, 1500);

    const firstRow = page
      .locator('tbody tr[role="link"], .divide-y > a')
      .first();
    if (await firstRow.isVisible().catch(() => false)) {
      await firstRow.click();
      await page.waitForLoadState('networkidle');
      await pause(page, 2000);
    }
  }

  await context.close();
  await browser.close();

  console.log(`Demo video saved to ${outputDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
