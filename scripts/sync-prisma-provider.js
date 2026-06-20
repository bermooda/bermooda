#!/usr/bin/env node
// Sync prisma/schema.prisma datasource provider with DATABASE_PROVIDER env.
// Used by CI Postgres jobs before `prisma db push`.

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const schemaPath = resolve('prisma/schema.prisma');
const provider =
  process.env.DATABASE_PROVIDER?.trim().toLowerCase() === 'postgresql' ||
  process.env.DATABASE_PROVIDER?.trim().toLowerCase() === 'postgres' ||
  (process.env.DATABASE_URL ?? '').startsWith('postgresql://') ||
  (process.env.DATABASE_URL ?? '').startsWith('postgres://')
    ? 'postgresql'
    : 'sqlite';

const schema = readFileSync(schemaPath, 'utf8');
const updated = schema.replace(
  /provider\s*=\s*"(sqlite|postgresql)"/,
  `provider = "${provider}"`
);

if (updated === schema && !schema.includes(`provider = "${provider}"`)) {
  console.error('Could not update datasource provider in prisma/schema.prisma');
  process.exit(1);
}

writeFileSync(schemaPath, updated);
console.log(`prisma/schema.prisma provider set to ${provider}`);
