import { describe, expect, it, vi } from 'vitest';

import { findNewestCompatibleVersion } from './install-default-extensions.mjs';

describe('findNewestCompatibleVersion', () => {
  it('returns the newest version whose engine accepts the shop version', () => {
    const engines = {
      '0.1.0': '>=0.1.0',
      '0.2.0': '>=0.10.0',
      '0.3.0': '>=1.0.0',
    };
    const engineFor = vi.fn((version) => engines[version]);

    expect(
      findNewestCompatibleVersion({
        versions: ['0.1.0', '0.3.0', '0.2.0'],
        shopVersion: '0.11.0',
        engineFor,
      })
    ).toBe('0.2.0');
    // Newest first, stopping at the first match.
    expect(engineFor.mock.calls.map(([v]) => v)).toEqual(['0.3.0', '0.2.0']);
  });

  it('returns null when no version is compatible', () => {
    expect(
      findNewestCompatibleVersion({
        versions: ['1.0.0', '2.0.0'],
        shopVersion: '0.11.0',
        engineFor: () => '>=1.0.0',
      })
    ).toBeNull();
  });

  it('skips prereleases and versions with a missing or invalid engine', () => {
    const engines = {
      '0.4.0-beta.1': '>=0.1.0',
      '0.3.0': undefined,
      '0.2.0': 'not a range',
      '0.1.0': '>=0.1.0',
    };

    expect(
      findNewestCompatibleVersion({
        versions: Object.keys(engines),
        shopVersion: '0.11.0',
        engineFor: (version) => engines[version],
      })
    ).toBe('0.1.0');
  });
});
