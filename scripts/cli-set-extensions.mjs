#!/usr/bin/env node
/**
 * Sets activeTheme and enabledPlugins settings via Prisma.
 *
 * Used by the bermooda CLI (theme add --activate, plugin add --enable) and by
 * the contributor install script. Reads env vars:
 *
 *   BERMOODA_ACTIVE_THEME     — package id to activate (e.g. @bermooda/theme-default)
 *   BERMOODA_ENABLED_PLUGINS  — comma-separated package ids (full replace when set)
 *   BERMOODA_ENABLE_PLUGIN    — single package id to append if not already present
 *
 * When both BERMOODA_ENABLED_PLUGINS and BERMOODA_ENABLE_PLUGIN are set, the
 * full replace is applied first, then the single id is appended if missing.
 *
 * Nothing to do only when none of the three vars are set.
 *
 * Usage:
 *   node --experimental-strip-types scripts/cli-set-extensions.mjs
 *   npm run cli:set-extensions
 */

import 'dotenv/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

import { PrismaClient } from '../app/generated/prisma/client.ts';

/** @returns {'sqlite' | 'postgresql'} */
function getDatabaseProvider() {
  const explicit = process.env.DATABASE_PROVIDER?.trim().toLowerCase();
  if (explicit === 'postgresql' || explicit === 'postgres') return 'postgresql';
  if (explicit === 'sqlite') return 'sqlite';
  const url = process.env.DATABASE_URL ?? '';
  if (url.startsWith('postgresql://') || url.startsWith('postgres://')) {
    return 'postgresql';
  }
  return 'sqlite';
}

function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }
  const provider = getDatabaseProvider();
  if (provider === 'postgresql') {
    const pool = new pg.Pool({ connectionString: databaseUrl });
    return new PrismaClient({ adapter: new PrismaPg(pool) });
  }
  return new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: databaseUrl }),
  });
}

/**
 * @param {import('../app/generated/prisma/client.ts').PrismaClient} prisma
 * @param {string} key
 * @param {unknown} value
 */
async function upsertSetting(prisma, key, value) {
  const serialized = JSON.stringify(value);
  await prisma.setting.upsert({
    where: { key },
    create: { key, value: serialized },
    update: { value: serialized },
  });
}

/**
 * @param {string} raw
 * @returns {string[]}
 */
function parseCommaSeparatedIds(raw) {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * @param {import('../app/generated/prisma/client.ts').PrismaClient} prisma
 * @returns {Promise<string[]>}
 */
async function readEnabledPlugins(prisma) {
  const row = await prisma.setting.findUnique({
    where: { key: 'enabledPlugins' },
  });
  if (!row?.value) return [];
  try {
    const parsed = JSON.parse(row.value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((id) => typeof id === 'string')
      .map((id) => id.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * @param {string[]} list
 * @param {string} id
 * @returns {string[]}
 */
function appendIfMissing(list, id) {
  if (list.includes(id)) return list;
  return [...list, id];
}

async function main() {
  const activeTheme = process.env.BERMOODA_ACTIVE_THEME?.trim() || '';
  const enabledPluginsRaw = process.env.BERMOODA_ENABLED_PLUGINS?.trim() || '';
  const enablePlugin = process.env.BERMOODA_ENABLE_PLUGIN?.trim() || '';

  if (!activeTheme && !enabledPluginsRaw && !enablePlugin) {
    console.log(
      'cli-set-extensions: nothing to do (set BERMOODA_ACTIVE_THEME, BERMOODA_ENABLED_PLUGINS, or BERMOODA_ENABLE_PLUGIN).'
    );
    return;
  }

  const prisma = createPrismaClient();
  try {
    if (activeTheme) {
      await upsertSetting(prisma, 'activeTheme', activeTheme);
      console.log(`cli-set-extensions: activeTheme → ${activeTheme}`);
    }

    if (enabledPluginsRaw || enablePlugin) {
      /** @type {string[] | null} */
      let enabledPlugins = enabledPluginsRaw
        ? parseCommaSeparatedIds(enabledPluginsRaw)
        : null;

      if (enablePlugin) {
        if (enabledPlugins === null) {
          enabledPlugins = await readEnabledPlugins(prisma);
        }
        enabledPlugins = appendIfMissing(enabledPlugins, enablePlugin);
      }

      await upsertSetting(prisma, 'enabledPlugins', enabledPlugins);
      console.log(
        `cli-set-extensions: enabledPlugins → [${enabledPlugins.join(', ')}]`
      );
    }

    console.log('cli-set-extensions: done.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('cli-set-extensions failed:', err.message);
  process.exit(1);
});
