import { describe, expect, it } from 'vitest';

import { jsonPaymentWebhookError } from './webhooks.server';

describe('jsonPaymentWebhookError', () => {
  it('maps verification failures to a generic message', async () => {
    const res = jsonPaymentWebhookError(
      Object.assign(new Error('Invalid signature'), {
        code: 'VERIFICATION_FAILED',
        status: 400,
      })
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: 'Webhook verification failed',
    });
  });

  it('returns the error message for other failures', async () => {
    const res = jsonPaymentWebhookError(
      Object.assign(new Error('DB exploded'), { status: 400 })
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'DB exploded' });
  });
});
