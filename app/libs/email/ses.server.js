import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

/**
 * Built-in Amazon SES email provider adapter.
 *
 * Credentials (first match wins):
 * - `SES_ACCESS_KEY_ID` / `SES_SECRET_ACCESS_KEY`
 * - `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`
 *
 * Region: `SES_REGION` or `AWS_REGION` (default `us-east-1`).
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
      const region =
        process.env.SES_REGION || process.env.AWS_REGION || 'us-east-1';
      const accessKeyId =
        process.env.SES_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
      const secretAccessKey =
        process.env.SES_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;

      if (!accessKeyId || !secretAccessKey) {
        throw new Error(
          'Amazon SES is not configured. Set SES_ACCESS_KEY_ID and SES_SECRET_ACCESS_KEY (or AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY).'
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
