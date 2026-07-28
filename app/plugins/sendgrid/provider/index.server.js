/**
 * Built-in SendGrid email provider adapter (HTTP API, no SDK).
 *
 * @returns {import('#/libs/email-types.server').EmailProvider}
 */
export function createSendGridEmailProvider() {
  return {
    id: 'sendgrid',
    name: 'SendGrid',
    /**
     * @param {import('#/libs/email-types.server').EmailMessage} message
     * @returns {Promise<import('#/libs/email-types.server').EmailSendResult>}
     */
    async send(message) {
      const apiKey = process.env.SENDGRID_API_KEY;
      if (!apiKey) {
        throw new Error(
          'SendGrid is not configured. Set SENDGRID_API_KEY in the environment.'
        );
      }

      const toList = Array.isArray(message.to) ? message.to : [message.to];
      /** @type {Record<string, unknown>} */
      const body = {
        personalizations: [
          {
            to: toList.map((email) => ({ email })),
          },
        ],
        from: parseAddress(message.from),
        subject: message.subject,
        content: [{ type: 'text/html', value: message.html }],
      };

      if (message.text) {
        /** @type {Array<{ type: string, value: string }>} */ (
          body.content
        ).unshift({ type: 'text/plain', value: message.text });
      }

      if (message.replyTo) {
        body.reply_to = parseAddress(message.replyTo);
      }

      if (message.headers) {
        body.headers = message.headers;
      }

      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `SendGrid email send failed (${response.status}): ${errorText || response.statusText}`
        );
      }

      const messageId = response.headers.get('x-message-id') ?? undefined;
      return {
        success: true,
        data: { status: response.status },
        id: messageId,
      };
    },
  };
}

/**
 * Parse `Name <email@domain>` or bare email into SendGrid address object.
 *
 * @param {string} value
 * @returns {{ email: string, name?: string }}
 */
function parseAddress(value) {
  const match = String(value)
    .trim()
    .match(/^(?:(.+?)\s*)?<([^>]+)>$|^([^<>\s]+@[^<>\s]+)$/);

  if (!match) {
    return { email: value };
  }

  if (match[3]) {
    return { email: match[3] };
  }

  const name = match[1]?.trim();
  const email = match[2]?.trim();
  return name ? { email, name } : { email };
}
