// app/core/admin-onboarding/index.test.server.js

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock prisma — hoisted before any module under test imports it
// ---------------------------------------------------------------------------

vi.mock('#/libs/prisma.server', () => {
  const tx = {
    user: { create: vi.fn() },
    setting: { create: vi.fn() },
  };

  const prisma = {
    user: { count: vi.fn() },
    setting: { findUnique: vi.fn() },
    $transaction: vi.fn((fn) => fn(tx)),
    _tx: tx,
  };

  return { default: prisma };
});

// ---------------------------------------------------------------------------
// Mock bcryptjs so tests don't pay the real cost of hashing
// ---------------------------------------------------------------------------

vi.mock('bcryptjs', () => ({
  default: { hash: vi.fn(async () => 'hashed_password') },
}));

import bcrypt from 'bcryptjs';

import prisma from '#/libs/prisma.server';
import {
  isOnboardingAvailable,
  validateOnboardingInput,
  createFirstAdmin,
} from '#/core/admin-onboarding/index.server';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_INPUT = {
  name: 'Alice Admin',
  email: 'alice@example.com',
  password: 'supersecret12',
  confirmPassword: 'supersecret12',
};

function makeUser(overrides = {}) {
  return {
    id: 'user_1',
    email: 'alice@example.com',
    name: 'Alice Admin',
    emailVerified: true,
    role: 'admin',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  prisma.$transaction.mockImplementation((fn) => fn(prisma._tx));
  prisma._tx.user.create.mockResolvedValue(makeUser());
  prisma._tx.setting.create.mockResolvedValue({});
});

// ---------------------------------------------------------------------------
// isOnboardingAvailable
// ---------------------------------------------------------------------------

describe('isOnboardingAvailable', () => {
  it('returns true when no setup flag and no admin users exist', async () => {
    prisma.setting.findUnique.mockResolvedValue(null);
    prisma.user.count.mockResolvedValue(0);

    expect(await isOnboardingAvailable()).toBe(true);
  });

  it('returns false when the setup-complete flag is set', async () => {
    prisma.setting.findUnique.mockResolvedValue({
      key: 'adminSetupComplete',
      value: 'true',
    });

    expect(await isOnboardingAvailable()).toBe(false);
    expect(prisma.user.count).not.toHaveBeenCalled();
  });

  it('returns false when an admin user already exists', async () => {
    prisma.setting.findUnique.mockResolvedValue(null);
    prisma.user.count.mockResolvedValue(1);

    expect(await isOnboardingAvailable()).toBe(false);
  });

  it('checks user count with role filter of admin', async () => {
    prisma.setting.findUnique.mockResolvedValue(null);
    prisma.user.count.mockResolvedValue(0);

    await isOnboardingAvailable();

    expect(prisma.user.count).toHaveBeenCalledWith({
      where: { role: 'admin' },
    });
  });
});

// ---------------------------------------------------------------------------
// validateOnboardingInput
// ---------------------------------------------------------------------------

describe('validateOnboardingInput', () => {
  it('returns null for fully valid input', () => {
    expect(validateOnboardingInput(VALID_INPUT)).toBeNull();
  });

  it('accepts uppercase email and a 12-character password at the exact minimum', () => {
    expect(
      validateOnboardingInput({
        ...VALID_INPUT,
        email: 'Alice@Example.COM',
        password: '123456789012',
        confirmPassword: '123456789012',
      })
    ).toBeNull();
  });

  it('returns name error when name is missing', () => {
    const errors = validateOnboardingInput({ ...VALID_INPUT, name: '' });
    expect(errors).toHaveProperty('name');
    expect(errors.email).toBeUndefined();
  });

  it('returns name error when name is only whitespace', () => {
    const errors = validateOnboardingInput({ ...VALID_INPUT, name: '   ' });
    expect(errors).toHaveProperty('name');
  });

  it('returns email error when email is missing', () => {
    const errors = validateOnboardingInput({ ...VALID_INPUT, email: '' });
    expect(errors).toHaveProperty('email');
  });

  it('returns email error when email shape is invalid', () => {
    const errors = validateOnboardingInput({
      ...VALID_INPUT,
      email: 'not-an-email',
    });
    expect(errors).toHaveProperty('email');
  });

  it('returns password error when password is missing', () => {
    const errors = validateOnboardingInput({
      ...VALID_INPUT,
      password: '',
      confirmPassword: '',
    });
    expect(errors).toHaveProperty('password');
  });

  it('returns password error when password is shorter than 12 characters', () => {
    const errors = validateOnboardingInput({
      ...VALID_INPUT,
      password: 'short1',
      confirmPassword: 'short1',
    });
    expect(errors).toHaveProperty('password');
    expect(errors.password).toMatch(/12/);
  });

  it('returns confirmPassword error when confirmation is missing', () => {
    const errors = validateOnboardingInput({
      ...VALID_INPUT,
      confirmPassword: '',
    });
    expect(errors).toHaveProperty('confirmPassword');
  });

  it('returns confirmPassword error when passwords do not match', () => {
    const errors = validateOnboardingInput({
      ...VALID_INPUT,
      confirmPassword: 'different_password',
    });
    expect(errors).toHaveProperty('confirmPassword');
    expect(errors.confirmPassword).toMatch(/match/i);
  });

  it('can return multiple field errors at once', () => {
    const errors = validateOnboardingInput({
      name: '',
      email: 'bad',
      password: 'short',
      confirmPassword: '',
    });
    expect(errors).toHaveProperty('name');
    expect(errors).toHaveProperty('email');
    expect(errors).toHaveProperty('password');
    expect(errors).toHaveProperty('confirmPassword');
  });
});

// ---------------------------------------------------------------------------
// createFirstAdmin
// ---------------------------------------------------------------------------

describe('createFirstAdmin', () => {
  function setAvailable(flag = null, count = 0) {
    prisma.setting.findUnique.mockResolvedValue(flag);
    prisma.user.count.mockResolvedValue(count);
  }

  it('creates user and account, marks setup complete, returns user', async () => {
    setAvailable();
    const user = makeUser();
    prisma._tx.user.create.mockResolvedValue(user);

    const result = await createFirstAdmin(VALID_INPUT);

    expect(result).toEqual(user);
    expect(prisma.$transaction).toHaveBeenCalledOnce();

    expect(prisma._tx.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'alice@example.com',
        name: 'Alice Admin',
        emailVerified: true,
        role: 'admin',
        accounts: {
          create: expect.objectContaining({
            accountId: 'alice@example.com',
            providerId: 'credential',
            password: 'hashed_password',
          }),
        },
      }),
    });

    expect(prisma._tx.setting.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ key: 'adminSetupComplete' }),
    });
  });

  it('normalizes email to lowercase before saving', async () => {
    setAvailable();

    await createFirstAdmin({ ...VALID_INPUT, email: 'ALICE@EXAMPLE.COM' });

    const call = prisma._tx.user.create.mock.calls[0][0];
    expect(call.data.email).toBe('alice@example.com');
    expect(call.data.accounts.create.accountId).toBe('alice@example.com');
  });

  it('hashes the password with bcrypt cost 12', async () => {
    setAvailable();

    await createFirstAdmin(VALID_INPUT);

    expect(bcrypt.hash).toHaveBeenCalledWith(VALID_INPUT.password, 12);
  });

  it('throws ONBOARDING_UNAVAILABLE when setup flag is already set', async () => {
    setAvailable({ key: 'adminSetupComplete', value: 'true' });

    await expect(createFirstAdmin(VALID_INPUT)).rejects.toMatchObject({
      code: 'ONBOARDING_UNAVAILABLE',
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('throws ONBOARDING_UNAVAILABLE when an admin already exists', async () => {
    setAvailable(null, 1);

    await expect(createFirstAdmin(VALID_INPUT)).rejects.toMatchObject({
      code: 'ONBOARDING_UNAVAILABLE',
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('throws VALIDATION_ERROR with field errors when input is invalid', async () => {
    setAvailable();

    const invalidInput = {
      name: '',
      email: 'bad-email',
      password: 'short',
      confirmPassword: 'different',
    };

    const err = await createFirstAdmin(invalidInput).catch((e) => e);

    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.errors).toHaveProperty('name');
    expect(err.errors).toHaveProperty('email');
    expect(err.errors).toHaveProperty('password');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('re-checks availability on every call', async () => {
    // First call: available → succeeds
    setAvailable();
    await createFirstAdmin(VALID_INPUT);
    expect(prisma.setting.findUnique).toHaveBeenCalledOnce();

    vi.clearAllMocks();
    prisma.$transaction.mockImplementation((fn) => fn(prisma._tx));
    prisma._tx.user.create.mockResolvedValue(makeUser());
    prisma._tx.setting.create.mockResolvedValue({});

    // Second call: now unavailable → throws
    setAvailable({ key: 'adminSetupComplete', value: 'true' });
    await expect(createFirstAdmin(VALID_INPUT)).rejects.toMatchObject({
      code: 'ONBOARDING_UNAVAILABLE',
    });
    expect(prisma.setting.findUnique).toHaveBeenCalledOnce();
  });
});
