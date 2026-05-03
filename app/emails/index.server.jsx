import { Resend } from 'resend';

import config from '#/config';
import logger from '#/utils/logger.server';
import InvitationTemplate from '#/emails/templates/invitation.server';
import ResetPasswordTemplate from '#/emails/templates/reset-password.server';
import TwoFactorOtpTemplate from '#/emails/templates/two-factor-otp.server';
import VerifyEmailTemplate from '#/emails/templates/verify-email.server';
import WelcomeEmail from '#/emails/templates/welcome.server';

// Initialize Resend with your API key
const resend = new Resend(process.env.RESEND_API_KEY);

// Email subjects
const SUBJECT_WELCOME = 'Welcome to CursorStack';
const SUBJECT_VERIFY_EMAIL = 'Please verify your email address';
const SUBJECT_RESET_PASSWORD = 'Reset your password';
const SUBJECT_TWO_FACTOR_OTP = 'Your verification code';
const SUBJECT_INVITATION = "You've been invited to join an organization";

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
          getStartedUrl={`${config.baseUrl}/dashboard`}
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

/**
 * Sends an organization invitation email
 *
 * @param {Object} options - Email sending options
 * @param {string} options.email - Recipient email address
 * @param {string} options.organizationName - Name of the organization
 * @param {string} options.inviterName - Name of the person inviting
 * @param {string} options.inviteUrl - URL to accept the invitation
 * @returns {Promise<Object>} - Resend API response
 */
export async function sendInvitationEmail({
  email,
  organizationName,
  inviterName,
  inviteUrl,
}) {
  try {
    const data = await resend.emails.send({
      from: config.resend.fromNoReply,
      to: email,
      subject: SUBJECT_INVITATION,
      react: (
        <InvitationTemplate
          organizationName={organizationName}
          inviterName={inviterName}
          inviteUrl={inviteUrl}
        />
      ),
    });

    logger.info(data, 'Invitation email sent successfully');
    return { success: true, data };
  } catch (error) {
    logger.error(error, 'Failed to send invitation email');
    throw error;
  }
}
