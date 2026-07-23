import { data } from 'react-router';

import logger from '#/utils/logger.server';
import { sendErrorAlert, SEVERITY } from '#/libs/alerting/index.server';
import { buildHandleErrorAlert } from '#/libs/alerting/shared/index.server';

/**
 * Handle error
 *
 * @param {Error|unknown} error - The error to handle
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
  const resolvedMessage =
    message ||
    (error instanceof Error ? error.message : undefined) ||
    'Something went wrong';

  logger.error(error, resolvedMessage);

  sendErrorAlert(
    buildHandleErrorAlert(error, {
      message: resolvedMessage,
      source,
      severity,
      metadata,
    })
  );

  return data(
    { error: userMessage || resolvedMessage, success: false },
    {
      status: status || 400,
    }
  );
};

export { SEVERITY };
