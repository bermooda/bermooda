import { render } from '@react-email/render';

import config, { PLATFORM_NAME } from '#/core/config';
import logger from '#/utils/logger.server';
import { sendEmail } from '#/libs/email/index.server';
import { get as settingsGet, SETTING_KEYS } from '#/core/settings/index.server';
import AbandonedCartEmail from '#/emails/shop/abandoned-cart';
import BackInStockEmail from '#/emails/shop/back-in-stock';
import CustomerWelcomeEmail from '#/emails/shop/customer-welcome';
import OrderConfirmationEmail from '#/emails/shop/order-confirmation';
import OrderDeliveredEmail from '#/emails/shop/order-delivered';
import OrderRefundedEmail from '#/emails/shop/order-refunded';
import OrderShippedEmail from '#/emails/shop/order-shipped';
import PasswordResetAdminEmail from '#/emails/shop/password-reset-admin';
import PasswordResetCustomerEmail from '#/emails/shop/password-reset-customer';
import ReturnReceivedEmail from '#/emails/shop/return-received';
import ResetPasswordTemplate from '#/emails/templates/reset-password.server';
import TwoFactorOtpTemplate from '#/emails/templates/two-factor-otp.server';
import VerifyEmailTemplate from '#/emails/templates/verify-email.server';
import WelcomeEmail from '#/emails/templates/welcome.server';

/**
 * Merchant shop brand for shop-facing email chrome. Falls back to the platform name.
 *
 * @returns {Promise<string>}
 */
async function resolveShopBrandName() {
  const name = await settingsGet(SETTING_KEYS.SHOP_NAME);
  if (typeof name === 'string' && name.trim()) return name.trim();
  return PLATFORM_NAME;
}

/**
 * Resolve the active email provider id from settings, then EMAIL_PROVIDER env.
 *
 * @returns {Promise<string | undefined>}
 */
async function resolveActiveProviderId() {
  const fromSettings = await settingsGet(SETTING_KEYS.EMAIL_PROVIDER);
  if (typeof fromSettings === 'string' && fromSettings.trim()) {
    return fromSettings.trim();
  }
  return undefined;
}

/**
 * Render a React Email element (when present) and send via the active provider.
 *
 * @param {Object} options
 * @param {string} options.to
 * @param {string} options.subject
 * @param {import('react').ReactElement} [options.react]
 * @param {string} [options.html]
 * @param {string} [options.text]
 * @param {string} [options.logMessage]
 * @returns {Promise<{ success: true, data: import('#/libs/email-types.server').EmailSendResult }>}
 */
async function deliver({ to, subject, react, html, text, logMessage }) {
  const renderedHtml = html ?? (react ? await render(react) : null);
  if (!renderedHtml) {
    throw new Error('Email requires either react or html content');
  }

  /** @type {import('#/libs/email-types.server').EmailMessage} */
  const message = {
    from: config.email.fromNoReply,
    to,
    subject,
    html: renderedHtml,
  };
  if (text) message.text = text;

  const providerId = await resolveActiveProviderId();
  const data = await sendEmail(
    message,
    providerId ? { providerId } : undefined
  );

  if (logMessage) {
    logger.info({ to, subject, providerId: providerId ?? null }, logMessage);
  }

  return { success: true, data };
}

// Email subjects — admin/auth
const SUBJECT_WELCOME = 'Welcome to bermooda';
const SUBJECT_VERIFY_EMAIL = 'Please verify your email address';
const SUBJECT_RESET_PASSWORD = 'Reset your password';
const SUBJECT_TWO_FACTOR_OTP = 'Your verification code';

// Email subjects — shop
const SUBJECT_ORDER_CONFIRMATION = 'Your order confirmation';
const SUBJECT_ORDER_SHIPPED = 'Your order has shipped';
const SUBJECT_ORDER_DELIVERED = 'Your order was delivered';
const SUBJECT_ORDER_REFUNDED = 'Refund processed';
const SUBJECT_RETURN_RECEIVED = 'Return received';
const SUBJECT_PASSWORD_RESET_ADMIN = 'Reset your admin password';
const SUBJECT_PASSWORD_RESET_CUSTOMER = 'Reset your password';
const SUBJECT_CUSTOMER_WELCOME_PREFIX = 'Welcome to';
const SUBJECT_ABANDONED_CART = 'You left something behind';
const SUBJECT_BACK_IN_STOCK = 'An item is back in stock';

/**
 * Sends a welcome email to a newly registered user
 *
 * @param {Object} options - Email sending options
 * @param {string} options.email - Recipient email address
 * @param {string} options.name - Recipient's name
 * @returns {Promise<{ success: true, data: unknown }>}
 */
export async function sendWelcomeEmail({ email, name }) {
  try {
    return await deliver({
      to: email,
      subject: SUBJECT_WELCOME,
      react: (
        <WelcomeEmail
          name={name}
          getStartedUrl={`${config.baseUrl}${config.auth.customerCallbackUrl}`}
        />
      ),
      logMessage: 'Welcome email sent successfully',
    });
  } catch (error) {
    logger.error(error, 'Failed to send welcome email');
    throw error;
  }
}

/**
 * Sends a verification email to a newly registered user
 *
 * @param {Object} options - Email sending options
 * @param {string} options.email - Recipient email address
 * @param {string} options.name - Recipient's name
 * @param {string} options.verificationUrl - The URL for email verification
 * @returns {Promise<{ success: true, data: unknown }>}
 */
export async function sendVerificationEmail({ email, name, verificationUrl }) {
  try {
    return await deliver({
      to: email,
      subject: SUBJECT_VERIFY_EMAIL,
      react: (
        <VerifyEmailTemplate name={name} verificationUrl={verificationUrl} />
      ),
      logMessage: 'Verification email sent successfully',
    });
  } catch (error) {
    logger.error(error, 'Failed to send verification email');
    throw error;
  }
}

/**
 * Sends a password reset email to a user
 *
 * @param {Object} options - Email sending options
 * @param {string} options.email - Recipient email address
 * @param {string} options.name - Recipient's name
 * @param {string} options.resetUrl - The URL for password reset
 * @returns {Promise<{ success: true, data: unknown }>}
 */
export async function sendPasswordResetEmail({ email, name, resetUrl }) {
  try {
    return await deliver({
      to: email,
      subject: SUBJECT_RESET_PASSWORD,
      react: <ResetPasswordTemplate name={name} resetUrl={resetUrl} />,
      logMessage: 'Password reset email sent successfully',
    });
  } catch (error) {
    logger.error(error, 'Failed to send password reset email');
    throw error;
  }
}

/**
 * Sends a two-factor authentication OTP code email
 *
 * @param {Object} options - Email sending options
 * @param {string} options.email - Recipient email address
 * @param {string} options.name - Recipient's name
 * @param {string} options.otp - The 6-digit OTP code
 * @returns {Promise<{ success: true, data: unknown }>}
 */
export async function sendTwoFactorOtpEmail({ email, name, otp }) {
  try {
    const firstName = name.split(' ')[0];

    return await deliver({
      to: email,
      subject: SUBJECT_TWO_FACTOR_OTP,
      react: <TwoFactorOtpTemplate name={firstName} otp={otp} />,
      logMessage: 'Two-factor OTP email sent successfully',
    });
  } catch (error) {
    logger.error(error, 'Failed to send two-factor OTP email');
    throw error;
  }
}

// ─── Shop emails ──────────────────────────────────────────────────────────────

/**
 * @param {Object} options
 * @param {string} options.email
 * @param {string} [options.locale]
 * @returns {Promise<{ success: true, data: unknown }>}
 */
export async function sendOrderConfirmationEmail({
  email,
  locale = 'en',
  ...props
}) {
  try {
    const brandName = await resolveShopBrandName();
    return await deliver({
      to: email,
      subject: SUBJECT_ORDER_CONFIRMATION,
      react: (
        <OrderConfirmationEmail
          locale={locale}
          brandName={brandName}
          {...props}
        />
      ),
      logMessage: 'Order confirmation email sent successfully',
    });
  } catch (error) {
    logger.error(error, 'Failed to send order confirmation email');
    throw error;
  }
}

/**
 * @param {Object} options
 * @param {string} options.email
 * @param {string} [options.locale]
 * @returns {Promise<{ success: true, data: unknown }>}
 */
export async function sendOrderShippedEmail({
  email,
  locale = 'en',
  ...props
}) {
  try {
    const brandName = await resolveShopBrandName();
    return await deliver({
      to: email,
      subject: SUBJECT_ORDER_SHIPPED,
      react: (
        <OrderShippedEmail locale={locale} brandName={brandName} {...props} />
      ),
      logMessage: 'Order shipped email sent successfully',
    });
  } catch (error) {
    logger.error(error, 'Failed to send order shipped email');
    throw error;
  }
}

/**
 * @param {Object} options
 * @param {string} options.email
 * @param {string} [options.locale]
 * @returns {Promise<{ success: true, data: unknown }>}
 */
export async function sendOrderDeliveredEmail({
  email,
  locale = 'en',
  ...props
}) {
  try {
    const brandName = await resolveShopBrandName();
    return await deliver({
      to: email,
      subject: SUBJECT_ORDER_DELIVERED,
      react: (
        <OrderDeliveredEmail locale={locale} brandName={brandName} {...props} />
      ),
      logMessage: 'Order delivered email sent successfully',
    });
  } catch (error) {
    logger.error(error, 'Failed to send order delivered email');
    throw error;
  }
}

/**
 * @param {Object} options
 * @param {string} options.email
 * @param {string} [options.locale]
 * @returns {Promise<{ success: true, data: unknown }>}
 */
export async function sendOrderRefundedEmail({
  email,
  locale = 'en',
  ...props
}) {
  try {
    const brandName = await resolveShopBrandName();
    return await deliver({
      to: email,
      subject: SUBJECT_ORDER_REFUNDED,
      react: (
        <OrderRefundedEmail locale={locale} brandName={brandName} {...props} />
      ),
      logMessage: 'Order refunded email sent successfully',
    });
  } catch (error) {
    logger.error(error, 'Failed to send order refunded email');
    throw error;
  }
}

/**
 * @param {Object} options
 * @param {string} options.email
 * @param {string} [options.locale]
 * @returns {Promise<{ success: true, data: unknown }>}
 */
export async function sendReturnReceivedEmail({
  email,
  locale = 'en',
  ...props
}) {
  try {
    const brandName = await resolveShopBrandName();
    return await deliver({
      to: email,
      subject: SUBJECT_RETURN_RECEIVED,
      react: (
        <ReturnReceivedEmail locale={locale} brandName={brandName} {...props} />
      ),
      logMessage: 'Return received email sent successfully',
    });
  } catch (error) {
    logger.error(error, 'Failed to send return received email');
    throw error;
  }
}

/**
 * @param {Object} options
 * @param {string} options.email
 * @param {string} [options.locale]
 * @param {string} options.name
 * @param {string} options.resetUrl
 * @returns {Promise<{ success: true, data: unknown }>}
 */
export async function sendPasswordResetAdminEmail({
  email,
  locale = 'en',
  name,
  resetUrl,
}) {
  try {
    return await deliver({
      to: email,
      subject: SUBJECT_PASSWORD_RESET_ADMIN,
      react: (
        <PasswordResetAdminEmail
          locale={locale}
          name={name}
          resetUrl={resetUrl}
        />
      ),
      logMessage: 'Admin password reset email sent successfully',
    });
  } catch (error) {
    logger.error(error, 'Failed to send admin password reset email');
    throw error;
  }
}

/**
 * @param {Object} options
 * @param {string} options.email
 * @param {string} [options.locale]
 * @param {string} options.name
 * @param {string} options.resetUrl
 * @returns {Promise<{ success: true, data: unknown }>}
 */
export async function sendPasswordResetCustomerEmail({
  email,
  locale = 'en',
  name,
  resetUrl,
}) {
  try {
    const brandName = await resolveShopBrandName();
    return await deliver({
      to: email,
      subject: SUBJECT_PASSWORD_RESET_CUSTOMER,
      react: (
        <PasswordResetCustomerEmail
          locale={locale}
          name={name}
          resetUrl={resetUrl}
          brandName={brandName}
        />
      ),
      logMessage: 'Customer password reset email sent successfully',
    });
  } catch (error) {
    logger.error(error, 'Failed to send customer password reset email');
    throw error;
  }
}

/**
 * @param {Object} options
 * @param {string} options.email
 * @param {string} [options.locale]
 * @param {string} options.name
 * @param {string} [options.accountUrl]
 * @returns {Promise<{ success: true, data: unknown }>}
 */
export async function sendCustomerWelcomeEmail({
  email,
  locale = 'en',
  name,
  accountUrl,
}) {
  try {
    const shopName = await resolveShopBrandName();
    return await deliver({
      to: email,
      subject: `${SUBJECT_CUSTOMER_WELCOME_PREFIX} ${shopName}`,
      react: (
        <CustomerWelcomeEmail
          locale={locale}
          name={name}
          accountUrl={accountUrl}
          shopName={shopName}
        />
      ),
      logMessage: 'Customer welcome email sent successfully',
    });
  } catch (error) {
    logger.error(error, 'Failed to send customer welcome email');
    throw error;
  }
}

/**
 * @param {Object} options
 * @param {string} options.email
 * @param {string} [options.locale]
 * @returns {Promise<{ success: true, data: unknown }>}
 */
export async function sendAbandonedCartEmail({
  email,
  locale = 'en',
  ...props
}) {
  try {
    const brandName = await resolveShopBrandName();
    return await deliver({
      to: email,
      subject: SUBJECT_ABANDONED_CART,
      react: (
        <AbandonedCartEmail locale={locale} brandName={brandName} {...props} />
      ),
      logMessage: 'Abandoned cart email sent successfully',
    });
  } catch (error) {
    logger.error(error, 'Failed to send abandoned cart email');
    throw error;
  }
}

/**
 * @param {Object} options
 * @param {string} options.to
 * @param {object} options.variant
 * @returns {Promise<{ success: true, data: unknown }>}
 */
export async function sendBackInStockEmail({ to, variant }) {
  try {
    const brandName = await resolveShopBrandName();
    return await deliver({
      to,
      subject: SUBJECT_BACK_IN_STOCK,
      react: <BackInStockEmail brandName={brandName} variant={variant} />,
      logMessage: 'Back-in-stock email sent successfully',
    });
  } catch (error) {
    logger.error(error, 'Failed to send back-in-stock email');
    throw error;
  }
}

/**
 * @param {Object} options
 * @param {string} options.to
 * @param {string} options.subject
 * @param {string} options.bodyHtml
 * @param {string} [options.name]
 * @returns {Promise<{ success: true, data: unknown }>}
 */
export async function sendCampaignEmail({ to, subject, bodyHtml, name }) {
  try {
    const html = bodyHtml.replace(/\{\{name\}\}/g, name ?? 'there');
    return await deliver({
      to,
      subject,
      html,
      logMessage: 'Campaign email sent successfully',
    });
  } catch (error) {
    logger.error(error, 'Failed to send campaign email');
    throw error;
  }
}
