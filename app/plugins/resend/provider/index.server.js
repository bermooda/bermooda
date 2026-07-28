import { Resend } from 'resend';

/**
 * Built-in Resend email provider adapter.
 *
 * @returns {import('#/libs/email-types.server').EmailProvider}
 */
export function createResendEmailProvider() {
  return {
    id: 'resend',
    name: 'Resend',
    /**
     * @param {import('#/libs/email-types.server').EmailMessage} message
     * @returns {Promise<import('#/libs/email-types.server').EmailSendResult>}
     */
    async send(message) {
      const apiKey = process.env.RESEND_API_KEY;
      if (!apiKey) {
        throw new Error(
          'Resend is not configured. Set RESEND_API_KEY in the environment.'
        );
      }

      const resend = new Resend(apiKey);
      /** @type {Record<string, unknown>} */
      const payload = {
        from: message.from,
        to: message.to,
        subject: message.subject,
        html: message.html,
      };

      if (message.text) payload.text = message.text;
      if (message.replyTo) payload.replyTo = message.replyTo;
      if (message.headers) payload.headers = message.headers;

      const { data, error } = await resend.emails.send(
        /** @type {any} */ (payload)
      );

      if (error) {
        throw new Error(
          typeof error === 'object' && error && 'message' in error
            ? String(/** @type {{ message: string }} */ (error).message)
            : 'Resend email send failed'
        );
      }

      return {
        success: true,
        data,
        id:
          data && typeof data === 'object' && 'id' in data
            ? data.id
            : undefined,
      };
    },
  };
}
