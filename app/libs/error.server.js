import { data } from 'react-router';

import logger from '#/utils/logger.server';
import { sendErrorAlert, SEVERITY } from '#/libs/alerting.server';

/**
 * Handle error
 *
 * @param {Error} error - The error to handle
 * @param {Object} [options] - Options
 * @param {string} [options.message] - The error message
 * @param {string} [options.source] - The source of the error
 * @param {string} [options.severity] - The severity of the error
 * @param {Object} [options.metadata] - Additional metadata about the error
 * @param {string} [options.userMessage] - The user-friendly message to display
 * @param {number} [options.status] - The HTTP status code to return
 */
export const handleError = (
  error,
  { message, source, severity, metadata, userMessage, status } = {}
) => {
  // Log for debugging
  logger.error(error, message);

  // Send error alert in production via configured provider
  sendErrorAlert({
    severity: severity || SEVERITY.HIGH,
    stack: error.stack,
    message,
    source,
    metadata,
  });

  return data(
    { error: userMessage || message, success: false },
    {
      status: status || 400,
    }
  );
};

export { SEVERITY };
