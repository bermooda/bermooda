import { describe, expect, it } from 'vitest';

import { jsonFromHookAbort } from '#/core/events/http.server';
import { HookAbortError } from '#/core/events/index.server';

describe('jsonFromHookAbort', () => {
  it('returns a hook veto payload', async () => {
    const err = new HookAbortError('Blocked by plugin', {
      code: 'HOOK_BLOCKED',
      pluginId: 'sample-plugin',
    });
    const response = jsonFromHookAbort(err);

    expect(response?.status).toBe(422);
    await expect(response?.json()).resolves.toEqual({
      error: 'Blocked by plugin',
      code: 'HOOK_BLOCKED',
      blockedBy: 'sample-plugin',
    });
  });

  it('returns null for non-hook errors', () => {
    const err = new Error('Regular failure');
    expect(jsonFromHookAbort(err)).toBeNull();
  });
});
