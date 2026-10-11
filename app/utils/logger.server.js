import pino from 'pino';

const CREDENTIAL_KEYS = [
  'password',
  'token',
  'secret',
  'apiKey',
  'authorization',
  'cookie',
  'set-cookie',
];

/**
 * Credential-shaped keys are censored at the top level of a log object and one
 * level down (for example `{ headers }` or `{ body }`).
 */
export const LOG_REDACT_PATHS = CREDENTIAL_KEYS.flatMap((key) => [
  `["${key}"]`,
  `*["${key}"]`,
]);

/**
 * Creates and configures a pino logger instance
 *
 * @param {pino.DestinationStream} [destination] - Output stream (tests); ignored in development, which pretty-prints
 * @returns {pino.Logger} Configured logger instance
 */
export function createLogger(destination) {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isProduction = process.env.NODE_ENV === 'production';

  const baseConfig = {
    level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
    name: process.env.APP_HANDLE || 'bermooda',
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: { paths: LOG_REDACT_PATHS, censor: '[REDACTED]' },
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
    return pino(
      {
        ...baseConfig,
        formatters: {
          level: (label) => {
            return { level: label };
          },
        },
      },
      destination
    );
  }

  // Default configuration for other environments
  return pino(baseConfig, destination);
}

/**
 * Configured logger instance
 */
const logger = createLogger();

export default logger;
