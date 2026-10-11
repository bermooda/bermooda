import { Writable } from 'node:stream';

import { describe, expect, it } from 'vitest';

import { createLogger } from '#/utils/logger.server';

function captureLogger() {
  /** @type {string[]} */
  const lines = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      lines.push(chunk.toString());
      callback();
    },
  });
  const logger = createLogger(stream);
  return { logger, read: () => JSON.parse(lines.at(-1) ?? '{}') };
}

describe('createLogger', () => {
  it('redacts credential-shaped keys at the top level and one level down', () => {
    const { logger, read } = captureLogger();

    logger.info(
      {
        orderId: 'ord_1',
        token: 'cart-token',
        headers: {
          'authorization': 'Bearer berm_live',
          'cookie': 'a=1',
          'set-cookie': 'b=2',
        },
        body: { email: 'a@example.com', password: 'hunter2' },
      },
      'request'
    );

    const entry = read();
    expect(entry.orderId).toBe('ord_1');
    expect(entry.token).toBe('[REDACTED]');
    expect(entry.headers).toEqual({
      'authorization': '[REDACTED]',
      'cookie': '[REDACTED]',
      'set-cookie': '[REDACTED]',
    });
    expect(entry.body).toEqual({
      email: 'a@example.com',
      password: '[REDACTED]',
    });
  });

  it('leaves log objects without credentials untouched', () => {
    const { logger, read } = captureLogger();
    logger.warn({ pluginId: 'resend', attempt: 2 }, 'retry');
    expect(read()).toMatchObject({ pluginId: 'resend', attempt: 2 });
  });
});
