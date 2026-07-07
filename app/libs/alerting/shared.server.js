import { SEVERITY } from '#/libs/alerting-types.server';

/**
 * Whether production error alerts and messages should be delivered.
 *
 * @returns {boolean}
 */
export function isAlertsEnabled() {
  if (process.env.NODE_ENV === 'development') {
    return false;
  }

  return process.env.ERROR_ALERTS_ENABLED !== 'false';
}

/**
 * Normalize string, Error, or alert object input into a consistent payload.
 *
 * @param {import('#/libs/alerting-types.server').ErrorAlert|string|Error} errorData
 * @returns {import('#/libs/alerting-types.server').ErrorAlert}
 */
export function normalizeErrorAlert(errorData) {
  if (typeof errorData === 'string') {
    return {
      message: errorData,
      timestamp: new Date().toISOString(),
      severity: SEVERITY.MEDIUM,
    };
  }

  if (errorData instanceof Error) {
    return {
      message: errorData.message,
      stack: errorData.stack,
      timestamp: new Date().toISOString(),
      severity: SEVERITY.HIGH,
    };
  }

  if (errorData && typeof errorData === 'object') {
    return {
      timestamp: new Date().toISOString(),
      severity: SEVERITY.MEDIUM,
      ...errorData,
    };
  }

  return {
    message: String(errorData),
    timestamp: new Date().toISOString(),
    severity: SEVERITY.MEDIUM,
  };
}

/**
 * Build an error alert payload from route/job error handling options.
 *
 * @param {Error|unknown} error
 * @param {object} [options]
 * @param {string} [options.message]
 * @param {string} [options.source]
 * @param {string} [options.severity]
 * @param {Object} [options.metadata]
 * @returns {import('#/libs/alerting-types.server').ErrorAlert}
 */
export function buildHandleErrorAlert(
  error,
  { message, source, severity, metadata } = {}
) {
  const resolvedMessage =
    message ||
    (error instanceof Error ? error.message : undefined) ||
    'Unknown error';

  return {
    message: resolvedMessage,
    stack: error instanceof Error ? error.stack : undefined,
    source,
    severity: severity || SEVERITY.HIGH,
    metadata,
    timestamp: new Date().toISOString(),
  };
}
