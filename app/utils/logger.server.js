import pino from 'pino';

/**
 * Creates and configures a pino logger instance
 * @returns {pino.Logger} Configured logger instance
 */
function createLogger() {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isProduction = process.env.NODE_ENV === 'production';

  const baseConfig = {
    level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
    name: process.env.APP_HANDLE || 'bermooda',
    timestamp: pino.stdTimeFunctions.isoTime,
  };

  if (isDevelopment) {
    // In development, use pretty printing for better readability
    return pino({
      ...baseConfig,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      },
    });
  }

  if (isProduction) {
    // In production, use structured JSON logging
    return pino({
      ...baseConfig,
      formatters: {
        level: (label) => {
          return { level: label };
        },
      },
    });
  }

  // Default configuration for other environments
  return pino(baseConfig);
}

/**
 * Configured logger instance
 */
const logger = createLogger();

export default logger;

/**
 * Creates a child logger with additional context
 * @param {Object} bindings - Additional context to bind to the logger
 * @returns {pino.Logger} Child logger instance
 */
export function createChildLogger(bindings) {
  return logger.child(bindings);
}
