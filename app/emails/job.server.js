import logger from '#/utils/logger.server';
import { handleError } from '#/libs/error.server';
import queue, { createThrottledJob } from '#/libs/queue.server';
import {
  sendPasswordResetEmail,
  sendTwoFactorOtpEmail,
  sendVerificationEmail,
} from '#/emails/index.server';

const verifyEmailJob = queue.createJob('verify_email');
const passwordResetEmailJob = queue.createJob('password_reset_email');
const twoFactorOtpJob = queue.createJob('two_factor_otp');

verifyEmailJob.process(async (taskData) => {
  await sendVerificationEmail({
    email: taskData.email,
    name: taskData.name,
    verificationUrl: taskData.url,
  });
});

passwordResetEmailJob.process(async (taskData) => {
  await sendPasswordResetEmail({
    email: taskData.email,
    name: taskData.name,
    resetUrl: taskData.url,
  });
});

twoFactorOtpJob.process(async (taskData) => {
  await sendTwoFactorOtpEmail({
    email: taskData.email,
    name: taskData.name,
    otp: taskData.otp,
  });
});

/**
 * Event Handlers
 */

verifyEmailJob.on('failed', async (event) => {
  handleError(event.error, {
    message: 'Verify email job failed',
    source: 'queue.server verifyEmailJob',
  });
});

passwordResetEmailJob.on('failed', async (event) => {
  handleError(event.error, {
    message: 'Password reset email job failed',
    source: 'queue.server passwordResetEmailJob',
  });
});

twoFactorOtpJob.on('failed', async (event) => {
  handleError(event.error, {
    message: 'Two-factor OTP email job failed',
    source: 'queue.server twoFactorOtpJob',
  });
});

/**
 * Queues a verification email to be sent
 *
 * @param {string} email - The email address to send the verification email to
 * @param {string} name - The name of the user to send the verification email to
 * @param {string} verificationUrl - The URL to verify the email
 */
export function queueVerifyEmail(email, name, verificationUrl) {
  logger.info(`Queueing verification email to: ${email}`);

  verifyEmailJob.add({
    email,
    name,
    url: verificationUrl,
  });
}

/**
 * Queues a password reset email to be sent
 *
 * @param {string} email - The email address to send the password reset email to
 * @param {string} name - The name of the user to send the password reset email to
 * @param {string} resetUrl - The URL to reset the password
 */
export function queuePasswordResetEmail(email, name, resetUrl) {
  logger.info(`Queueing password reset email to: ${email}`);

  passwordResetEmailJob.add({
    email,
    name,
    url: resetUrl,
  });
}

export const queueTwoFactorOtp = createThrottledJob(
  function queueTwoFactorOtpInternal(email, name, otp) {
    logger.info(`Queueing two-factor OTP email to: ${email}`);

    twoFactorOtpJob.add({
      email,
      name,
      otp,
    });
  },
  (email) => `otp:${email}`,
  5000
);
