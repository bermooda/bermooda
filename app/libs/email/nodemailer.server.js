// app/libs/email/nodemailer.server.js
// Built-in Nodemailer SMTP transport (default email provider).

import nodemailer from 'nodemailer';

import config from '#/libs/config';

/** @type {import('nodemailer').Transporter | null} */
let _transporter = null;

/**
 * Resolve Nodemailer transport options from bermooda.config `email.smtp`.
 * When unset, returns `{}` so Nodemailer uses its SMTP defaults
 * (localhost:587, no auth).
 *
 * @param {unknown} [smtp]
 * @returns {import('nodemailer').TransportOptions | string}
 */
export function resolveNodemailerTransportOptions(smtp) {
  if (typeof smtp === 'string' && smtp.trim() !== '') {
    return smtp.trim();
  }

  if (smtp && typeof smtp === 'object' && !Array.isArray(smtp)) {
    return /** @type {import('nodemailer').TransportOptions} */ (smtp);
  }

  return {};
}

/**
 * Create (or reuse) the Nodemailer transporter for the process.
 *
 * @returns {import('nodemailer').Transporter}
 */
function getTransporter() {
  if (!_transporter) {
    _transporter = nodemailer.createTransport(
      resolveNodemailerTransportOptions(config.email?.smtp)
    );
  }
  return _transporter;
}

/**
 * Built-in Nodemailer email provider adapter.
 *
 * @returns {import('#/libs/email-types.server').EmailProvider}
 */
export function createNodemailerEmailProvider() {
  return {
    id: 'nodemailer',
    name: 'Nodemailer (SMTP)',
    /**
     * @param {import('#/libs/email-types.server').EmailMessage} message
     * @returns {Promise<import('#/libs/email-types.server').EmailSendResult>}
     */
    async send(message) {
      const transporter = getTransporter();

      /** @type {import('nodemailer').SendMailOptions} */
      const mail = {
        from: message.from,
        to: message.to,
        subject: message.subject,
        html: message.html,
      };

      if (message.text) mail.text = message.text;
      if (message.replyTo) mail.replyTo = message.replyTo;
      if (message.headers) mail.headers = message.headers;

      const info = await transporter.sendMail(mail);

      return {
        success: true,
        data: info,
        id:
          info && typeof info === 'object' && 'messageId' in info
            ? String(info.messageId)
            : undefined,
      };
    },
  };
}

/** Reset cached transporter. Test use only — never call in production. */
export function __resetNodemailerTransporter() {
  _transporter = null;
}
