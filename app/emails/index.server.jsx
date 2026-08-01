import { render } from '@react-email/render';

import config, { PLATFORM_NAME } from '#/libs/config';
import logger from '#/utils/logger.server';
import { sendEmail } from '#/libs/email/index.server';
import prisma from '#/libs/prisma.server';
import { DEFAULT_LOCALE, isValidLocaleTag } from '#/core/i18n/locales';
import { get as settingsGet, SETTING_KEYS } from '#/core/settings/index.server';
import { emailT } from '#/emails/i18n.server';
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
import StaffInviteEmail from '#/emails/shop/staff-invite';
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

  const data = await sendEmail(message);

  if (logMessage) {
    logger.info({ to, subject }, logMessage);
  }

  return { success: true, data };
}

/**
 * Resolve locale for auth emails, which do not have request context.
 * Customer-facing auth emails prefer the customer's saved locale when known.
 *
 * @param {Object} [options]
 * @param {string} [options.email]
 * @param {string} [options.locale]
 * @param {boolean} [options.preferCustomerLocale]
 * @returns {Promise<string>}
 */
async function resolveAuthEmailLocale({
  email,
  locale,
  preferCustomerLocale = true,
} = {}) {
  if (locale && isValidLocaleTag(locale)) return locale;

  if (preferCustomerLocale && email) {
    const customer = await prisma.customer.findUnique({
      where: { email },
      select: { preferredLocale: true },
    });
    if (
      customer?.preferredLocale &&
      isValidLocaleTag(customer.preferredLocale)
    ) {
      return customer.preferredLocale;
    }
  }

  const defaultLocale = await settingsGet(SETTING_KEYS.DEFAULT_LOCALE);
  return typeof defaultLocale === 'string' && isValidLocaleTag(defaultLocale)
    ? defaultLocale
    : DEFAULT_LOCALE;
}

/**
 * @param {string} resetUrl
 * @returns {boolean}
 */
function isAdminPasswordResetUrl(resetUrl) {
  return (
    typeof resetUrl === 'string' && resetUrl.includes(config.auth.adminBasePath)
  );
}

/**
 * Sends a welcome email to a newly registered user
 *
 * @param {Object} options - Email sending options
 * @param {string} options.email - Recipient email address
 * @param {string} options.name - Recipient's name
 * @param {string} [options.locale] - Explicit locale override
 * @returns {Promise<{ success: true, data: unknown }>}
 */
export async function sendWelcomeEmail({ email, name, locale }) {
  try {
    const resolvedLocale = await resolveAuthEmailLocale({ email, locale });
    const t = emailT(resolvedLocale);

    return await deliver({
      to: email,
      subject: t('authWelcome.subject', { platformName: PLATFORM_NAME }),
      react: (
        <WelcomeEmail
          locale={resolvedLocale}
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
 * @param {string} [options.locale] - Explicit locale override
 * @returns {Promise<{ success: true, data: unknown }>}
 */
export async function sendVerificationEmail({
  email,
  name,
  verificationUrl,
  locale,
}) {
  try {
    const resolvedLocale = await resolveAuthEmailLocale({ email, locale });
    const t = emailT(resolvedLocale);

    return await deliver({
      to: email,
      subject: t('authVerify.subject'),
      react: (
        <VerifyEmailTemplate
          locale={resolvedLocale}
          name={name}
          verificationUrl={verificationUrl}
        />
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
 * @param {string} [options.locale] - Explicit locale override
 * @returns {Promise<{ success: true, data: unknown }>}
 */
export async function sendPasswordResetEmail({
  email,
  name,
  resetUrl,
  locale,
}) {
  try {
    const resolvedLocale = await resolveAuthEmailLocale({
      email,
      locale,
      preferCustomerLocale: !isAdminPasswordResetUrl(resetUrl),
    });
    const t = emailT(resolvedLocale);

    return await deliver({
      to: email,
      subject: t('authResetPassword.subject'),
      react: (
        <ResetPasswordTemplate
          locale={resolvedLocale}
          name={name}
          resetUrl={resetUrl}
        />
      ),
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
 * @param {string} [options.locale] - Explicit locale override
 * @returns {Promise<{ success: true, data: unknown }>}
 */
export async function sendTwoFactorOtpEmail({ email, name, otp, locale }) {
  try {
    const resolvedLocale = await resolveAuthEmailLocale({
      locale,
      preferCustomerLocale: false,
    });
    const t = emailT(resolvedLocale);
    const firstName = name.split(' ')[0];

    return await deliver({
      to: email,
      subject: t('authTwoFactor.subject'),
      react: (
        <TwoFactorOtpTemplate
          locale={resolvedLocale}
          name={firstName}
          otp={otp}
        />
      ),
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
    const t = emailT(locale);
    return await deliver({
      to: email,
      subject: t('orderConfirmation.subject'),
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
    const t = emailT(locale);
    return await deliver({
      to: email,
      subject: t('orderShipped.subject'),
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
    const t = emailT(locale);
    return await deliver({
      to: email,
      subject: t('orderDelivered.subject'),
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
    const t = emailT(locale);
    return await deliver({
      to: email,
      subject: t('orderRefunded.subject'),
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
    const t = emailT(locale);
    return await deliver({
      to: email,
      subject: t('returnReceived.subject'),
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
    const t = emailT(locale);
    return await deliver({
      to: email,
      subject: t('passwordResetAdmin.subject'),
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
 * Sends an invite email so a new staff member can create their password.
 *
 * @param {Object} options
 * @param {string} options.email
 * @param {string} [options.locale]
 * @param {string} options.name
 * @param {string} options.inviteUrl
 * @returns {Promise<{ success: true, data: unknown }>}
 */
export async function sendStaffInviteEmail({
  email,
  locale = 'en',
  name,
  inviteUrl,
}) {
  try {
    const t = emailT(locale);
    return await deliver({
      to: email,
      subject: t('staffInvite.subject', { platformName: PLATFORM_NAME }),
      react: (
        <StaffInviteEmail locale={locale} name={name} inviteUrl={inviteUrl} />
      ),
      logMessage: 'Staff invite email sent successfully',
    });
  } catch (error) {
    logger.error(error, 'Failed to send staff invite email');
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
    const t = emailT(locale);
    return await deliver({
      to: email,
      subject: t('passwordResetCustomer.subject'),
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
    const t = emailT(locale);
    return await deliver({
      to: email,
      subject: t('customerWelcome.subject', { shopName }),
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
    const t = emailT(locale);
    return await deliver({
      to: email,
      subject: t('abandonedCart.subject'),
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
 * @param {string} [options.locale]
 * @returns {Promise<{ success: true, data: unknown }>}
 */
export async function sendBackInStockEmail({ to, variant, locale = 'en' }) {
  try {
    const brandName = await resolveShopBrandName();
    const t = emailT(locale);
    return await deliver({
      to,
      subject: t('backInStock.subject'),
      react: (
        <BackInStockEmail
          locale={locale}
          brandName={brandName}
          variant={variant}
        />
      ),
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
