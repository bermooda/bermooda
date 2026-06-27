import { createTelegramNotifier } from '#/libs/telegram.server';

/**
 * Built-in Telegram alert provider adapter.
 *
 * @returns {import('#/libs/alerting-types.server').AlertProvider}
 */
export function createTelegramAlertProvider() {
  return {
    id: 'telegram',
    name: 'Telegram',
    async sendError(errorData, options = {}) {
      const notifier = createTelegramNotifier();

      if (!notifier) {
        return false;
      }

      return notifier.sendError(errorData, options);
    },
  };
}
