/**
 * Shared types for transactional email providers.
 */

/**
 * @typedef {Object} EmailMessage
 * @property {string} from - Sender address (e.g. `Shop <noreply@example.com>`)
 * @property {string|string[]} to - Recipient address(es)
 * @property {string} subject - Email subject line
 * @property {string} html - Rendered HTML body
 * @property {string} [text] - Optional plain-text body
 * @property {Record<string, string>} [headers] - Optional custom headers
 * @property {string} [replyTo] - Optional reply-to address
 */

/**
 * @typedef {Object} EmailSendResult
 * @property {boolean} success
 * @property {unknown} [data] - Provider-specific response payload
 * @property {string} [id] - Provider message id when available
 */

/**
 * @typedef {Object} EmailProvider
 * @property {string} id - Provider identifier used in EMAIL_PROVIDER / settings
 * @property {string} [name] - Human-readable provider name
 * @property {(message: EmailMessage) => Promise<EmailSendResult>} send
 */

export {};
