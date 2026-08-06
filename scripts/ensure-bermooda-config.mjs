#!/usr/bin/env node
/**
 * Ensure bermooda.config.js exists for Vite / `#bermooda.config`.
 * Copies from bermooda.config.example.js when missing (dev clones, Cloud Agent).
 * Merchant installs should prefer CLI-generated config from install/dev-setup.
 */
import { copyFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const configPath = join(root, 'bermooda.config.js');
const examplePath = join(root, 'bermooda.config.example.js');

if (existsSync(configPath)) {
  process.exit(0);
}

if (!existsSync(examplePath)) {
  console.error(
    'ensure-bermooda-config: missing bermooda.config.example.js; cannot create bermooda.config.js'
  );
  process.exit(1);
}

copyFileSync(examplePath, configPath);
console.log('Created bermooda.config.js from bermooda.config.example.js');
