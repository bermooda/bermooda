import { Resend } from 'resend';

import config from '#bermooda.config';
import logger from '#/utils/logger.server';
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

// Initialize Resend with your API key
const resend = new Resend(process.env.RESEND_API_KEY);

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
const SUBJECT_CUSTOMER_WELCOME = `Welcome to ${config.appName}`;
const SUBJECT_ABANDONED_CART = 'You left something behind';
const SUBJECT_BACK_IN_STOCK = 'An item is back in stock';

/**
 * Sends a welcome email to a newly registered user
 *
 * @param {Object} options - Email sending options
 * @param {string} options.email - Recipient email address
 * @param {string} options.name - Recipient's name
 * @returns {Promise<Object>} - Resend API response
 */
export async function sendWelcomeEmail({ email, name }) {
  try {
    // Send the email using Resend
    const data = await resend.emails.send({
      from: config.resend.fromNoReply,
      to: email,
      subject: SUBJECT_WELCOME,
      react: (
        <WelcomeEmail
          name={name}
          getStartedUrl={`${config.baseUrl}${config.auth.customerCallbackUrl}`}
        />
      ),
    });

    logger.info(data, 'Welcome email sent successfully');
    return { success: true, data };
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
 * @returns {Promise<Object>} - Resend API response
 */
export async function sendVerificationEmail({ email, name, verificationUrl }) {
  try {
    // Send the email using Resend
    const data = await resend.emails.send({
      from: config.resend.fromNoReply,
      to: email,
      subject: SUBJECT_VERIFY_EMAIL,
      react: (
        <VerifyEmailTemplate name={name} verificationUrl={verificationUrl} />
      ),
    });

    logger.info(data, 'Verification email sent successfully');
    return { success: true, data };
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
 * @returns {Promise<Object>} - Resend API response
 */
export async function sendPasswordResetEmail({ email, name, resetUrl }) {
  try {
    // Send the email using Resend
    const data = await resend.emails.send({
      from: config.resend.fromNoReply,
      to: email,
      subject: SUBJECT_RESET_PASSWORD,
      react: <ResetPasswordTemplate name={name} resetUrl={resetUrl} />,
    });

    logger.info(data, 'Password reset email sent successfully');
    return { success: true, data };
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
 * @returns {Promise<Object>} - Resend API response
 */
export async function sendTwoFactorOtpEmail({ email, name, otp }) {
  try {
    const firstName = name.split(' ')[0];

    const data = await resend.emails.send({
      from: config.resend.fromNoReply,
      to: email,
      subject: SUBJECT_TWO_FACTOR_OTP,
      react: <TwoFactorOtpTemplate name={firstName} otp={otp} />,
    });

    logger.info({ email }, 'Two-factor OTP email sent successfully');
    return { success: true, data };
  } catch (error) {
    logger.error(error, 'Failed to send two-factor OTP email');
    throw error;
  }
}

// ─── Shop emails ──────────────────────────────────────────────────────────────

export async function sendOrderConfirmationEmail({
  email,
  locale = 'en',
  ...props
}) {
  try {
    const data = await resend.emails.send({
      from: config.resend.fromNoReply,
      to: email,
      subject: SUBJECT_ORDER_CONFIRMATION,
      react: <OrderConfirmationEmail locale={locale} {...props} />,
    });

    logger.info({ email }, 'Order confirmation email sent successfully');
    return { success: true, data };
  } catch (error) {
    logger.error(error, 'Failed to send order confirmation email');
    throw error;
  }
}

export async function sendOrderShippedEmail({
  email,
  locale = 'en',
  ...props
}) {
  try {
    const data = await resend.emails.send({
      from: config.resend.fromNoReply,
      to: email,
      subject: SUBJECT_ORDER_SHIPPED,
      react: <OrderShippedEmail locale={locale} {...props} />,
    });

    logger.info({ email }, 'Order shipped email sent successfully');
    return { success: true, data };
  } catch (error) {
    logger.error(error, 'Failed to send order shipped email');
    throw error;
  }
}

export async function sendOrderDeliveredEmail({
  email,
  locale = 'en',
  ...props
}) {
  try {
    const data = await resend.emails.send({
      from: config.resend.fromNoReply,
      to: email,
      subject: SUBJECT_ORDER_DELIVERED,
      react: <OrderDeliveredEmail locale={locale} {...props} />,
    });

    logger.info({ email }, 'Order delivered email sent successfully');
    return { success: true, data };
  } catch (error) {
    logger.error(error, 'Failed to send order delivered email');
    throw error;
  }
}

export async function sendOrderRefundedEmail({
  email,
  locale = 'en',
  ...props
}) {
  try {
    const data = await resend.emails.send({
      from: config.resend.fromNoReply,
      to: email,
      subject: SUBJECT_ORDER_REFUNDED,
      react: <OrderRefundedEmail locale={locale} {...props} />,
    });

    logger.info({ email }, 'Order refunded email sent successfully');
    return { success: true, data };
  } catch (error) {
    logger.error(error, 'Failed to send order refunded email');
    throw error;
  }
}

export async function sendReturnReceivedEmail({
  email,
  locale = 'en',
  ...props
}) {
  try {
    const data = await resend.emails.send({
      from: config.resend.fromNoReply,
      to: email,
      subject: SUBJECT_RETURN_RECEIVED,
      react: <ReturnReceivedEmail locale={locale} {...props} />,
    });

    logger.info({ email }, 'Return received email sent successfully');
    return { success: true, data };
  } catch (error) {
    logger.error(error, 'Failed to send return received email');
    throw error;
  }
}

export async function sendPasswordResetAdminEmail({
  email,
  locale = 'en',
  name,
  resetUrl,
}) {
  try {
    const data = await resend.emails.send({
      from: config.resend.fromNoReply,
      to: email,
      subject: SUBJECT_PASSWORD_RESET_ADMIN,
      react: (
        <PasswordResetAdminEmail
          locale={locale}
          name={name}
          resetUrl={resetUrl}
        />
      ),
    });

    logger.info({ email }, 'Admin password reset email sent successfully');
    return { success: true, data };
  } catch (error) {
    logger.error(error, 'Failed to send admin password reset email');
    throw error;
  }
}

export async function sendPasswordResetCustomerEmail({
  email,
  locale = 'en',
  name,
  resetUrl,
}) {
  try {
    const data = await resend.emails.send({
      from: config.resend.fromNoReply,
      to: email,
      subject: SUBJECT_PASSWORD_RESET_CUSTOMER,
      react: (
        <PasswordResetCustomerEmail
          locale={locale}
          name={name}
          resetUrl={resetUrl}
        />
      ),
    });

    logger.info({ email }, 'Customer password reset email sent successfully');
    return { success: true, data };
  } catch (error) {
    logger.error(error, 'Failed to send customer password reset email');
    throw error;
  }
}

export async function sendCustomerWelcomeEmail({
  email,
  locale = 'en',
  name,
  accountUrl,
}) {
  try {
    const data = await resend.emails.send({
      from: config.resend.fromNoReply,
      to: email,
      subject: SUBJECT_CUSTOMER_WELCOME,
      react: (
        <CustomerWelcomeEmail
          locale={locale}
          name={name}
          accountUrl={accountUrl}
        />
      ),
    });

    logger.info({ email }, 'Customer welcome email sent successfully');
    return { success: true, data };
  } catch (error) {
    logger.error(error, 'Failed to send customer welcome email');
    throw error;
  }
}

export async function sendAbandonedCartEmail({
  email,
  locale = 'en',
  ...props
}) {
  try {
    const data = await resend.emails.send({
      from: config.resend.fromNoReply,
      to: email,
      subject: SUBJECT_ABANDONED_CART,
      react: <AbandonedCartEmail locale={locale} {...props} />,
    });

    logger.info({ email }, 'Abandoned cart email sent successfully');
    return { success: true, data };
  } catch (error) {
    logger.error(error, 'Failed to send abandoned cart email');
    throw error;
  }
}

export async function sendBackInStockEmail({ to, variant }) {
  try {
    const data = await resend.emails.send({
      from: config.resend.fromNoReply,
      to,
      subject: SUBJECT_BACK_IN_STOCK,
      react: <BackInStockEmail variant={variant} />,
    });

    logger.info({ to }, 'Back-in-stock email sent successfully');
    return { success: true, data };
  } catch (error) {
    logger.error(error, 'Failed to send back-in-stock email');
    throw error;
  }
}

export async function sendCampaignEmail({ to, subject, bodyHtml, name }) {
  try {
    const html = bodyHtml.replace(/\{\{name\}\}/g, name ?? 'there');
    const data = await resend.emails.send({
      from: config.resend.fromNoReply,
      to,
      subject,
      html,
    });

    logger.info({ to, subject }, 'Campaign email sent successfully');
    return { success: true, data };
  } catch (error) {
    logger.error(error, 'Failed to send campaign email');
    throw error;
  }
}
