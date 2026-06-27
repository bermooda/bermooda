import { Telegraf } from 'telegraf';

import logger from '#/utils/logger.server';
import { SEVERITY } from '#/libs/alerting-types.server';

/**
 * @typedef {Object} TelegramConfig
 * @property {string} botToken - The Telegram bot token obtained from BotFather
 * @property {string} chatId - The chat ID where messages will be sent
 * @property {boolean} [enabled=true] - Whether notifications are enabled
 * @property {number} [timeout=5000] - Request timeout in milliseconds
 * @property {number} [retryAttempts=3] - Number of retry attempts for failed requests
 * @property {number} [retryDelay=1000] - Delay between retry attempts in milliseconds
 */

/**
 * @typedef {Object} ErrorMessage
 * @property {string} message - The error message
 * @property {string} [stack] - The error stack trace
 * @property {string} [timestamp] - ISO timestamp of the error
 * @property {string} [source] - Source of the error (e.g., API endpoint, function name)
 * @property {string} [severity] - Error severity level (low, medium, high, critical)
 * @property {Object} [metadata] - Additional metadata about the error
 */

/**
 * @typedef {Object} NotificationOptions
 * @property {boolean} [silent=false] - Send notification silently
 * @property {boolean} [disableWebPagePreview=true] - Disable web page preview
 * @property {import('telegraf/types').ParseMode} [parseMode='HTML'] - Message parse mode (HTML, Markdown, MarkdownV2)
 * @property {boolean} [includeStackTrace=true] - Whether to include stack trace in error messages
 * @property {number} [maxMessageLength=4096] - Maximum message length (Telegram limit)
 * @property {string} [headline] - The headline of the message
 * @property {Object} [metadata] - Additional metadata to include in the message
 */

export { SEVERITY };

/**
 * Telegram Notifier Service
 * Provides functionality to send error messages and notifications via Telegram Bot API
 */
class TelegramNotifier {
  /**
   * Create a TelegramNotifier instance
   * @param {TelegramConfig} config - Configuration object
   */
  constructor(config) {
    if (!config?.botToken) {
      throw new Error('Telegram bot token is required');
    }

    if (!config?.chatId) {
      throw new Error('Telegram chat ID is required');
    }

    this.config = {
      enabled: true,
      timeout: 5000,
      retryAttempts: 3,
      retryDelay: 1000,
      ...config,
    };

    this.bot = new Telegraf(this.config.botToken);
    this.isInitialized = false;
  }

  /**
   * Initialize the Telegram bot
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    try {
      // Test bot token by getting bot info
      const botInfo = await this.bot.telegram.getMe();
      logger.info(`Telegram bot initialized: @${botInfo.username}`);
      this.isInitialized = true;
    } catch (error) {
      logger.error(error, 'Failed to initialize Telegram bot:');
      throw new Error(`Telegram bot initialization failed: ${error.message}`);
    }
  }

  /**
   * Send an error message to Telegram
   * @param {ErrorMessage|string|Error} errorData - Error data to send
   * @param {NotificationOptions} [options={}] - Notification options
   * @returns {Promise<boolean>} - Returns true if message was sent successfully
   */
  async sendError(errorData, options = {}) {
    if (!this.config.enabled) {
      logger.info('Telegram notifications are disabled');
      return false;
    }

    try {
      await this.initialize();

      const errorMessage = this._formatErrorMessage(errorData, options);
      const success = await this._sendMessageWithRetry(errorMessage, options);

      if (success) {
        logger.info('Error notification sent to Telegram successfully');
      }

      return success;
    } catch (error) {
      logger.error(error, 'Failed to send error notification to Telegram:');
      return false;
    }
  }

  /**
   * Send a general notification message to Telegram
   * @param {string} message - Message to send
   * @param {NotificationOptions} [options={}] - Notification options
   * @returns {Promise<boolean>} - Returns true if message was sent successfully
   */
  async sendNotification(message, options = {}) {
    if (!this.config.enabled) {
      logger.info('Telegram notifications are disabled');
      return false;
    }

    try {
      await this.initialize();

      const formattedMessage = this._formatMessage(
        message,
        options.headline || 'INFO',
        options.metadata
      );
      const success = await this._sendMessageWithRetry(
        formattedMessage,
        options
      );

      if (success) {
        logger.info('Notification sent to Telegram successfully');
      }

      return success;
    } catch (error) {
      logger.error(error, 'Failed to send notification to Telegram:');
      return false;
    }
  }

  /**
   * Send a warning message to Telegram
   * @param {string} message - Warning message to send
   * @param {NotificationOptions} [options={}] - Notification options
   * @returns {Promise<boolean>} - Returns true if message was sent successfully
   */
  async sendWarning(message, options = {}) {
    if (!this.config.enabled) {
      logger.info('Telegram notifications are disabled');
      return false;
    }

    try {
      await this.initialize();

      const formattedMessage = this._formatMessage(
        message,
        'WARNING',
        options.metadata
      );
      const success = await this._sendMessageWithRetry(
        formattedMessage,
        options
      );

      if (success) {
        logger.info('Warning sent to Telegram successfully');
      }

      return success;
    } catch (error) {
      logger.error(error, 'Failed to send warning to Telegram:');
      return false;
    }
  }

  /**
   * Format error message for Telegram
   * @param {ErrorMessage|string|Error} errorData - Error data
   * @param {NotificationOptions} options - Notification options
   * @returns {string} - Formatted message
   * @private
   */
  _formatErrorMessage(errorData, options = {}) {
    const defaultOptions = {
      includeStackTrace: true,
      maxMessageLength: 4096,
    };
    const opts = { ...defaultOptions, ...options };

    let message = '';
    let errorObj = {};

    // Handle different error data types
    if (typeof errorData === 'string') {
      errorObj = {
        message: errorData,
        timestamp: new Date().toISOString(),
        severity: SEVERITY.MEDIUM,
      };
    } else if (errorData instanceof Error) {
      errorObj = {
        message: errorData.message,
        stack: errorData.stack,
        timestamp: new Date().toISOString(),
        severity: SEVERITY.HIGH,
      };
    } else if (typeof errorData === 'object') {
      errorObj = {
        timestamp: new Date().toISOString(),
        severity: SEVERITY.MEDIUM,
        ...errorData,
      };
    }

    // Build message
    const severityEmoji = this._getSeverityEmoji(errorObj.severity);
    message += `${severityEmoji} <b>ERROR</b>\n\n`;

    if (errorObj.source) {
      message += `<b>Source:</b> ${this._escapeHtml(errorObj.source)}\n`;
    }

    message += `<b>Message:</b> ${this._escapeHtml(errorObj.message)}\n`;

    if (errorObj.timestamp) {
      message += `<b>Time:</b> ${errorObj.timestamp}\n`;
    }

    if (errorObj.metadata && Object.keys(errorObj.metadata).length > 0) {
      message += `<b>Metadata:</b>\n`;
      Object.entries(errorObj.metadata).forEach(([key, value]) => {
        message += `  • ${this._escapeHtml(key)}: ${this._escapeHtml(String(value))}\n`;
      });
    }

    // Add stack trace if available and enabled
    if (opts.includeStackTrace && errorObj.stack) {
      const stackTrace = this._escapeHtml(errorObj.stack);
      const stackSection = `\n<b>Stack Trace:</b>\n<pre>${stackTrace}</pre>`;

      // Check if adding stack trace exceeds message limit
      if ((message + stackSection).length <= opts.maxMessageLength) {
        message += stackSection;
      } else {
        // Truncate stack trace to fit within limit
        const availableSpace = opts.maxMessageLength - message.length - 50; // 50 chars buffer
        if (availableSpace > 100) {
          const truncatedStack =
            stackTrace.substring(0, availableSpace) + '...';
          message += `\n<b>Stack Trace:</b>\n<pre>${truncatedStack}</pre>`;
        } else {
          message += '\n<i>Stack trace too long to display</i>';
        }
      }
    }

    // Ensure message doesn't exceed Telegram's limit
    if (message.length > opts.maxMessageLength) {
      message =
        message.substring(0, opts.maxMessageLength - 20) +
        '\n\n<i>...truncated</i>';
    }

    return message;
  }

  /**
   * Format a general message for Telegram
   * @param {string} message - Message to format
   * @param {string} type - Message type (INFO, WARNING, etc.)
   * @param {Object} [metadata] - Additional metadata to include
   * @returns {string} - Formatted message
   * @private
   */
  _formatMessage(message, type = 'INFO', metadata = {}) {
    const timestamp = new Date().toISOString();
    const emoji = type === 'WARNING' ? '⚠️' : 'ℹ️';

    let formattedMessage =
      `${emoji} <b>${type}</b>\n\n` +
      `<b>Message:</b> ${this._escapeHtml(message)}\n` +
      `<b>Time:</b> ${timestamp}\n`;

    // Add metadata if provided
    if (metadata && Object.keys(metadata).length > 0) {
      formattedMessage += `<b>Metadata:</b>\n`;
      Object.entries(metadata).forEach(([key, value]) => {
        formattedMessage += `  • ${this._escapeHtml(key)}: ${this._escapeHtml(String(value))}\n`;
      });
    }

    return formattedMessage;
  }

  /**
   * Get emoji for error severity
   * @param {string} severity - Error severity
   * @returns {string} - Emoji
   * @private
   */
  _getSeverityEmoji(severity) {
    const emojiMap = {
      low: '🟡',
      medium: '🟠',
      high: '🔴',
      critical: '💀',
    };
    return emojiMap[severity] || '🔴';
  }

  /**
   * Escape HTML characters for Telegram
   * @param {string} text - Text to escape
   * @returns {string} - Escaped text
   * @private
   */
  _escapeHtml(text) {
    if (typeof text !== 'string') {
      return String(text);
    }

    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Send message with retry logic
   * @param {string} message - Message to send
   * @param {NotificationOptions} options - Options
   * @returns {Promise<boolean>} - Success status
   * @private
   */
  async _sendMessageWithRetry(message, options = {}) {
    const parseMode = options.parseMode || 'HTML';
    const sendOptions = {
      parse_mode: parseMode,
      disable_web_page_preview: options.disableWebPagePreview !== false,
      disable_notification: options.silent || false,
    };

    // Validate parse mode
    if (!['HTML', 'Markdown', 'MarkdownV2'].includes(parseMode)) {
      throw new Error(
        `Invalid parse mode: ${parseMode}. Use 'HTML', 'Markdown', or 'MarkdownV2'.`
      );
    }

    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        await this.bot.telegram.sendMessage(
          this.config.chatId,
          message,
          sendOptions
        );
        return true;
      } catch (error) {
        logger.error(error, `Telegram send attempt ${attempt} failed:`);

        if (attempt === this.config.retryAttempts) {
          throw error;
        }

        // Wait before retrying
        await this._sleep(this.config.retryDelay * attempt);
      }
    }

    return false;
  }

  /**
   * Sleep for specified milliseconds
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   * @private
   */
  _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Enable or disable notifications
   * @param {boolean} enabled - Whether to enable notifications
   */
  setEnabled(enabled) {
    this.config.enabled = !!enabled;
    logger.info(`Telegram notifications ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Check if the service is enabled
   * @returns {boolean} - Whether notifications are enabled
   */
  isEnabled() {
    return this.config.enabled;
  }

  /**
   * Get bot information
   * @returns {Promise<Object|null>} - Bot information or null if not initialized
   */
  async getBotInfo() {
    try {
      await this.initialize();
      return await this.bot.telegram.getMe();
    } catch (error) {
      logger.error(error, 'Failed to get bot info:');
      return null;
    }
  }
}

// Singleton instance for default usage
let defaultNotifier = null;

/**
 * Create or get the default TelegramNotifier instance
 * @returns {TelegramNotifier | null} - TelegramNotifier instance or false if not initialized
 */
export function createTelegramNotifier() {
  if (defaultNotifier) {
    return defaultNotifier;
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    logger.warn(
      'Telegram bot token or chat ID not configured in environment variables. ' +
        'Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID to enable notifications.'
    );
    return null;
  }

  defaultNotifier = new TelegramNotifier({
    botToken,
    chatId,
    enabled: process.env.TELEGRAM_NOTIFICATIONS_ENABLED !== 'false',
  });

  return defaultNotifier;
}

/**
 * Quick function to send error notifications using environment variables
 * @param {ErrorMessage|string|Error} errorData - Error data
 * @param {NotificationOptions} [options] - Options
 * @returns {Promise<boolean>} - Success status
 */
export async function sendTelegramError(errorData, options = {}) {
  if (process.env.NODE_ENV === 'development') {
    return true;
  }

  try {
    const notifier = createTelegramNotifier();

    if (!notifier) {
      return false;
    }

    return await notifier.sendError(errorData, options);
  } catch (error) {
    logger.error(error, 'Failed to send error notification');
    return false;
  }
}

/**
 * Quick function to send general notifications using environment variables
 * @param {string} message - Message to send
 * @param {NotificationOptions} [options] - Options (can include metadata property)
 * @returns {Promise<boolean>} - Success status
 */
export async function sendTelegramMessage(message, options = {}) {
  if (process.env.NODE_ENV === 'development') {
    return true;
  }

  try {
    const notifier = createTelegramNotifier();

    if (!notifier) {
      return false;
    }

    return await notifier.sendNotification(message, options);
  } catch (error) {
    logger.error(error, 'Failed to send notification');
    return false;
  }
}

export { TelegramNotifier };
export default TelegramNotifier;
