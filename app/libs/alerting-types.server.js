/**
 * Shared error alert types and severity levels for alerting providers.
 */

/**
 * @typedef {Object} ErrorAlert
 * @property {string} message - The error message
 * @property {string} [stack] - The error stack trace
 * @property {string} [timestamp] - ISO timestamp of the error
 * @property {string} [source] - Source of the error (e.g. API endpoint, function name)
 * @property {string} [severity] - Error severity level (low, medium, high, critical)
 * @property {Object} [metadata] - Additional metadata about the error
 */

/**
 * @typedef {Object} AlertOptions
 * @property {boolean} [silent=false] - Send notification silently
 * @property {boolean} [includeStackTrace=true] - Whether to include stack trace
 * @property {string} [headline] - Optional headline for the alert
 * @property {Object} [metadata] - Additional metadata to include
 */

/**
 * @typedef {Object} AlertProvider
 * @property {string} id - Provider identifier used in ERROR_ALERT_PROVIDER
 * @property {string} [name] - Human-readable provider name
 * @property {(errorData: ErrorAlert|string|Error, options?: AlertOptions) => Promise<boolean>} sendError
 */

export const SEVERITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
};
