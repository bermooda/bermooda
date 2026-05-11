// app/core/admin-onboarding/index.server.js
// First-admin onboarding workflow: availability check, input validation, creation.

import bcrypt from 'bcryptjs';

import prisma from '#/libs/prisma.server';

const SETUP_COMPLETE_KEY = 'adminSetupComplete';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 12;

// ---------------------------------------------------------------------------
// isOnboardingAvailable
// ---------------------------------------------------------------------------

/**
 * Returns true only when no admin user exists AND the one-time setup flag has
 * not been persisted. Once the flag is set it stays set, so deleting the last
 * admin cannot silently re-expose the onboarding form.
 *
 * @returns {Promise<boolean>}
 */
export async function isOnboardingAvailable() {
  const flag = await prisma.setting.findUnique({
    where: { key: SETUP_COMPLETE_KEY },
  });
  if (flag !== null) return false;

  const adminCount = await prisma.user.count({ where: { role: 'admin' } });
  return adminCount === 0;
}

// ---------------------------------------------------------------------------
// validateOnboardingInput
// ---------------------------------------------------------------------------

/**
 * Validates the first-admin creation form fields.
 * Email is matched after lowercasing; no mutation of the input object occurs.
 *
 * @param {{ name: string, email: string, password: string, confirmPassword: string }} input
 * @returns {Record<string,string>|null} Field-keyed error messages, or null when valid.
 */
export function validateOnboardingInput({
  name,
  email,
  password,
  confirmPassword,
}) {
  const errors = {};

  if (!name || !name.trim()) {
    errors.name = 'Name is required.';
  }

  const normalizedEmail = email ? email.trim().toLowerCase() : '';
  if (!normalizedEmail) {
    errors.email = 'Email is required.';
  } else if (!EMAIL_RE.test(normalizedEmail)) {
    errors.email = 'Enter a valid email address.';
  }

  if (!password) {
    errors.password = 'Password is required.';
  } else if (password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }

  if (!confirmPassword) {
    errors.confirmPassword = 'Please confirm your password.';
  } else if (password && password !== confirmPassword) {
    errors.confirmPassword = 'Passwords do not match.';
  }

  return Object.keys(errors).length > 0 ? errors : null;
}

// ---------------------------------------------------------------------------
// createFirstAdmin
// ---------------------------------------------------------------------------

/**
 * Creates the first admin user and marks setup as complete.
 * Re-checks availability on every call to prevent races.
 * Throws if onboarding is unavailable or input is invalid.
 *
 * @param {{ name: string, email: string, password: string, confirmPassword: string }} input
 * @returns {Promise<object>} The created User record.
 */
export async function createFirstAdmin({
  name,
  email,
  password,
  confirmPassword,
}) {
  const available = await isOnboardingAvailable();
  if (!available) {
    const err = new Error('Onboarding is not available.');
    err.code = 'ONBOARDING_UNAVAILABLE';
    throw err;
  }

  const errors = validateOnboardingInput({
    name,
    email,
    password,
    confirmPassword,
  });
  if (errors) {
    const err = new Error('Validation failed.');
    err.code = 'VALIDATION_ERROR';
    err.errors = errors;
    throw err;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(password, 12);

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: normalizedEmail,
        name: name.trim(),
        emailVerified: true,
        role: 'admin',
        accounts: {
          create: {
            accountId: normalizedEmail,
            providerId: 'credential',
            password: passwordHash,
          },
        },
      },
    });

    await tx.setting.create({
      data: { key: SETUP_COMPLETE_KEY, value: JSON.stringify(true) },
    });

    return user;
  });
}
