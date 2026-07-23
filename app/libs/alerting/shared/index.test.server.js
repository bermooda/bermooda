import { describe, expect, it } from 'vitest';

import { SEVERITY } from '#/libs/alerting-types.server';
import {
  buildHandleErrorAlert,
  isAlertsEnabled,
  normalizeErrorAlert,
} from '#/libs/alerting/shared/index.server';

describe('isAlertsEnabled', () => {
  it('returns false in development', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.ERROR_ALERTS_ENABLED;

    expect(isAlertsEnabled()).toBe(false);
  });

  it('returns false when globally disabled', () => {
    process.env.NODE_ENV = 'production';
    process.env.ERROR_ALERTS_ENABLED = 'false';

    expect(isAlertsEnabled()).toBe(false);
  });

  it('returns true in production when alerts are enabled', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ERROR_ALERTS_ENABLED;

    expect(isAlertsEnabled()).toBe(true);
  });
});

describe('normalizeErrorAlert', () => {
  it('normalizes string input', () => {
    const alert = normalizeErrorAlert('Something failed');

    expect(alert.message).toBe('Something failed');
    expect(alert.severity).toBe(SEVERITY.MEDIUM);
    expect(alert.timestamp).toBeTruthy();
  });

  it('normalizes Error input', () => {
    const error = new Error('Boom');
    const alert = normalizeErrorAlert(error);

    expect(alert.message).toBe('Boom');
    expect(alert.stack).toBe(error.stack);
    expect(alert.severity).toBe(SEVERITY.HIGH);
  });

  it('preserves explicit fields on object input', () => {
    const alert = normalizeErrorAlert({
      message: 'Custom',
      source: 'test',
      severity: SEVERITY.CRITICAL,
      metadata: { orderId: '1' },
    });

    expect(alert).toMatchObject({
      message: 'Custom',
      source: 'test',
      severity: SEVERITY.CRITICAL,
      metadata: { orderId: '1' },
    });
    expect(alert.timestamp).toBeTruthy();
  });
});

describe('buildHandleErrorAlert', () => {
  it('uses the provided message and severity', () => {
    const alert = buildHandleErrorAlert(new Error('Original'), {
      message: 'Wrapped failure',
      source: 'jobs',
      severity: SEVERITY.CRITICAL,
      metadata: { job: 'email' },
    });

    expect(alert).toMatchObject({
      message: 'Wrapped failure',
      source: 'jobs',
      severity: SEVERITY.CRITICAL,
      metadata: { job: 'email' },
    });
    expect(alert.stack).toBeTruthy();
  });

  it('falls back to the error message when no message is provided', () => {
    const alert = buildHandleErrorAlert(new Error('Import failed'), {
      source: 'admin.import',
    });

    expect(alert.message).toBe('Import failed');
    expect(alert.source).toBe('admin.import');
    expect(alert.severity).toBe(SEVERITY.HIGH);
  });

  it('uses a generic message for non-Error values', () => {
    const alert = buildHandleErrorAlert('plain failure');

    expect(alert.message).toBe('Unknown error');
    expect(alert.stack).toBeUndefined();
  });
});
