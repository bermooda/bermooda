// app/core/i18n/check-key-coverage.test.server.js
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  checkAllCatalogs,
  checkCatalogCoverage,
  findMissingKeys,
  flattenLeafKeys,
  formatCoverageFailures,
} from '../../../scripts/check-i18n-key-coverage.mjs';

describe('flattenLeafKeys', () => {
  it('returns flat dotted keys unchanged', () => {
    expect(
      flattenLeafKeys({
        'common.save': 'Save',
        'admin.nav.dashboard': 'Dashboard',
      }).sort()
    ).toEqual(['admin.nav.dashboard', 'common.save']);
  });

  it('normalizes nested objects to dotted leaf paths', () => {
    expect(
      flattenLeafKeys({
        common: { save: 'Save', cancel: 'Cancel' },
        admin: { topbar: { switchLocale: 'Switch locale' } },
      }).sort()
    ).toEqual(['admin.topbar.switchLocale', 'common.cancel', 'common.save']);
  });

  it('mixes nested branches with already-flat sibling keys', () => {
    expect(
      flattenLeafKeys({
        'common': { loading: 'Loading...' },
        'admin.chrome.logout': 'Logout',
      }).sort()
    ).toEqual(['admin.chrome.logout', 'common.loading']);
  });
});

describe('findMissingKeys', () => {
  it('reports keys present in base but absent from locale', () => {
    expect(findMissingKeys(['a', 'b', 'c'], ['a', 'c'])).toEqual(['b']);
  });

  it('ignores extra locale keys', () => {
    expect(findMissingKeys(['a'], ['a', 'extra'])).toEqual([]);
  });
});

describe('checkCatalogCoverage', () => {
  it('passes when de/fr cover every en leaf key', () => {
    const dir = mkdtempSync(join(tmpdir(), 'i18n-coverage-ok-'));
    writeFileSync(
      join(dir, 'en.json'),
      JSON.stringify({ 'common': { save: 'Save' }, 'admin.nav': 'Nav' })
    );
    writeFileSync(
      join(dir, 'de.json'),
      JSON.stringify({ 'common.save': 'Speichern', 'admin.nav': 'Nav' })
    );
    writeFileSync(
      join(dir, 'fr.json'),
      JSON.stringify({ 'common': { save: 'Enregistrer' }, 'admin.nav': 'Nav' })
    );

    const result = checkCatalogCoverage(dir, { label: 'fixture' });
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('fails when a locale is missing nested-normalized keys', () => {
    const dir = mkdtempSync(join(tmpdir(), 'i18n-coverage-miss-'));
    writeFileSync(
      join(dir, 'en.json'),
      JSON.stringify({ common: { save: 'Save', cancel: 'Cancel' } })
    );
    writeFileSync(
      join(dir, 'de.json'),
      JSON.stringify({ 'common.save': 'Speichern' })
    );
    writeFileSync(
      join(dir, 'fr.json'),
      JSON.stringify({
        'common.save': 'Enregistrer',
        'common.cancel': 'Annuler',
      })
    );

    const result = checkCatalogCoverage(dir, { label: 'fixture' });
    expect(result.ok).toBe(false);
    expect(result.issues).toEqual([
      { locale: 'de', missing: ['common.cancel'] },
    ]);
    expect(formatCoverageFailures([result])).toContain('common.cancel');
  });
});

describe('checkAllCatalogs (repo catalogs)', () => {
  it('passes for current emails and core message catalogs', () => {
    const results = checkAllCatalogs();
    expect(results.map((r) => ({ label: r.label, ok: r.ok }))).toEqual([
      { label: 'emails', ok: true },
      { label: 'core messages', ok: true },
    ]);
  });
});
