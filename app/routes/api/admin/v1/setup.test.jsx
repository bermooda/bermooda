import { describe, expect, it, vi } from 'vitest';

vi.mock('#/libs/rate-limit.server', () => ({
  rateLimitMiddleware: (policy) =>
    Object.assign(async (_args, next) => next(), { policy }),
}));

vi.mock('#/core/setup/index.server', () => ({
  getSetupStatus: vi.fn(),
}));

import { getSetupStatus } from '#/core/setup/index.server';

import { loader, middleware } from '#/routes/api/admin/v1/setup';

describe('GET /api/admin/v1/setup', () => {
  it('uses the setup rate-limit policy', () => {
    expect(middleware.map((m) => m.policy)).toEqual(['setup']);
  });

  it('returns the setup status snapshot', async () => {
    const setup = {
      onboardingAvailable: false,
      adminExists: true,
      adminSetupComplete: true,
      apiKeyCount: 1,
      bootstrapApiKeyAvailable: false,
      setupTokenConfigured: true,
    };
    getSetupStatus.mockResolvedValue(setup);

    const response = await loader();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ setup });
  });
});
