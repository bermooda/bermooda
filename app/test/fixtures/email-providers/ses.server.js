import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

import {
  getPluginSettingSecret,
  getPluginSettingValue,
} from '#/core/plugins/settings.server';

const PLUGIN_ID = '@bermooda/plugin-aws-ses';

/**
 * Built-in Amazon SES email provider adapter.
 *
 * Credentials and region are configured under Admin → Plugins → Amazon SES
 * (encrypted at rest for access keys).
 *
 * @returns {import('#/libs/email-types.server').EmailProvider}
 */
export function createSesEmailProvider() {
  return {
    id: 'ses',
    name: 'Amazon SES',
    /**
     * @param {import('#/libs/email-types.server').EmailMessage} message
     * @returns {Promise<import('#/libs/email-types.server').EmailSendResult>}
     */
    async send(message) {
      const [regionRaw, accessKeyId, secretAccessKey] = await Promise.all([
        getPluginSettingValue(PLUGIN_ID, 'region'),
        getPluginSettingSecret(PLUGIN_ID, 'accessKeyId'),
        getPluginSettingSecret(PLUGIN_ID, 'secretAccessKey'),
      ]);

      const region =
        typeof regionRaw === 'string' && regionRaw.trim()
          ? regionRaw.trim()
          : 'us-east-1';

      if (!accessKeyId || !secretAccessKey) {
        throw new Error(
          'Amazon SES is not configured. Set Access Key ID and Secret Access Key under Admin → Plugins → Amazon SES.'
        );
      }

      const client = new SESClient({
        region,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });

      const toAddresses = Array.isArray(message.to) ? message.to : [message.to];
      /** @type {import('@aws-sdk/client-ses').SendEmailCommandInput} */
      const input = {
        Source: message.from,
        Destination: { ToAddresses: toAddresses },
        Message: {
          Subject: { Data: message.subject, Charset: 'UTF-8' },
          Body: {
            Html: { Data: message.html, Charset: 'UTF-8' },
          },
        },
      };

      if (message.text && input.Message?.Body) {
        input.Message.Body.Text = {
          Data: message.text,
          Charset: 'UTF-8',
        };
      }

      if (message.replyTo) {
        input.ReplyToAddresses = [message.replyTo];
      }

      const result = await client.send(new SendEmailCommand(input));
      return {
        success: true,
        data: result,
        id: result.MessageId,
      };
    },
  };
}
