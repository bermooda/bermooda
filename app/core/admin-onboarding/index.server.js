// app/core/admin-onboarding/index.server.js
// First-admin onboarding workflow: availability check, input validation, creation.

import bcrypt from 'bcryptjs';

import { isValidEmail, normalizeEmail } from '#/utils/email';
import prisma from '#/libs/prisma.server';
import { SETTING_KEYS } from '#/core/settings/keys';

export const ADMIN_ONBOARDING_MIN_PASSWORD_LENGTH = 12;

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
    where: { key: SETTING_KEYS.ADMIN_SETUP_COMPLETE },
  });
  if (flag !== null) return false;

  const adminCount = await prisma.user.count({ where: { role: 'admin' } });
  return adminCount === 0;
}

/**
 * Resolve the admin entry page mode for unauthenticated visitors.
 *
 * @returns {Promise<'onboarding' | 'login'>}
 */
export async function resolveAdminEntryMode() {
  return (await isOnboardingAvailable()) ? 'onboarding' : 'login';
}

// ---------------------------------------------------------------------------
// Form parsing and validation
// ---------------------------------------------------------------------------

/**
 * Parse onboarding form fields from a FormData submission.
 *
 * @param {FormData} formData
 * @returns {{ intent: string, name: string, email: string, password: string, confirmPassword: string }}
 */
export function parseOnboardingFormData(formData) {
  return {
    intent: String(formData.get('_intent') ?? ''),
    name: String(formData.get('name') ?? ''),
    email: String(formData.get('email') ?? ''),
    password: String(formData.get('password') ?? ''),
    confirmPassword: String(formData.get('confirmPassword') ?? ''),
  };
}

/**
 * Non-sensitive fields to repopulate after a validation error.
 *
 * @param {{ name?: string, email?: string }} input
 * @returns {{ name: string, email: string }}
 */
export function onboardingFormFieldsForReplay({ name = '', email = '' } = {}) {
  return { name, email };
}

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

  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    errors.email = 'Email is required.';
  } else if (!isValidEmail(email)) {
    errors.email = 'Enter a valid email address.';
  }

  if (!password) {
    errors.password = 'Password is required.';
  } else if (password.length < ADMIN_ONBOARDING_MIN_PASSWORD_LENGTH) {
    errors.password = `Password must be at least ${ADMIN_ONBOARDING_MIN_PASSWORD_LENGTH} characters.`;
  }

  if (!confirmPassword) {
    errors.confirmPassword = 'Please confirm your password.';
  } else if (password && password !== confirmPassword) {
    errors.confirmPassword = 'Passwords do not match.';
  }

  return Object.keys(errors).length > 0 ? errors : null;
}

// ---------------------------------------------------------------------------
// Action error mapping
// ---------------------------------------------------------------------------

/**
 * Map a createFirstAdmin failure to an HTTP action payload.
 * Returns null when the caller should treat the error as unexpected.
 *
 * @param {Error & { code?: string, errors?: Record<string, string> }} error
 * @param {{ name: string, email: string }} fields
 * @returns {{ status: number, body: object } | null}
 */
export function mapOnboardingActionError(error, fields) {
  if (error.code === 'ONBOARDING_UNAVAILABLE') {
    return {
      status: 409,
      body: { error: 'Setup is already complete. Please sign in.' },
    };
  }

  if (error.code === 'VALIDATION_ERROR') {
    return {
      status: 422,
      body: {
        fieldErrors: error.errors,
        fields: onboardingFormFieldsForReplay(fields),
      },
    };
  }

  return null;
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
    throw Object.assign(new Error('Onboarding is not available.'), {
      code: 'ONBOARDING_UNAVAILABLE',
    });
  }

  const errors = validateOnboardingInput({
    name,
    email,
    password,
    confirmPassword,
  });
  if (errors) {
    throw Object.assign(new Error('Validation failed.'), {
      code: 'VALIDATION_ERROR',
      errors,
    });
  }

  const normalizedEmail = normalizeEmail(email);
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
      data: {
        key: SETTING_KEYS.ADMIN_SETUP_COMPLETE,
        value: JSON.stringify(true),
      },
    });

    return user;
  });
}
