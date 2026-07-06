// app/core/rbac/index.test.server.js

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('#/libs/prisma.server', () => ({
  default: {
    rolePermission: {
      findMany: vi.fn(),
      count: vi.fn(),
      createMany: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    account: {
      create: vi.fn(),
    },
  },
}));

import prisma from '#/libs/prisma.server';
import {
  __resetPermissionCache,
  createAdminStaffUser,
  getAdminUser,
  hasPermission,
  listAdminUsers,
  listRolePermissions,
  parseAdminRole,
  parseCreateAdminUserInput,
  seedRolePermissions,
  updateAdminUserRole,
} from '#/core/rbac/index.server';

describe('rbac', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetPermissionCache();
  });

  it('admin role has wildcard access', async () => {
    prisma.rolePermission.findMany.mockResolvedValue([]);
    expect(await hasPermission('admin', 'settings:manage')).toBe(true);
  });

  it('staff role is denied settings:manage by default', async () => {
    prisma.rolePermission.findMany.mockResolvedValue([]);
    expect(await hasPermission('staff', 'settings:manage')).toBe(false);
    expect(await hasPermission('staff', 'products:read')).toBe(true);
  });

  it('seedRolePermissions writes defaults when empty', async () => {
    prisma.rolePermission.count.mockResolvedValue(0);
    prisma.rolePermission.createMany.mockResolvedValue({ count: 1 });

    await seedRolePermissions();

    expect(prisma.rolePermission.createMany).toHaveBeenCalledOnce();
  });

  it('listRolePermissions returns sorted permissions by role', async () => {
    prisma.rolePermission.findMany.mockResolvedValue([]);

    const permissions = await listRolePermissions();

    expect(permissions.admin).toEqual(['*']);
    expect(permissions.staff).toContain('products:read');
    expect(permissions.staff).not.toContain('settings:manage');
  });

  it('parseAdminRole rejects invalid roles', () => {
    expect(() => parseAdminRole('owner')).toThrow(/Invalid admin role/);
    expect(parseAdminRole('staff')).toBe('staff');
  });

  it('parseCreateAdminUserInput validates email', () => {
    expect(() => parseCreateAdminUserInput({ email: '' })).toThrow(
      /Email is required/
    );
    expect(() =>
      parseCreateAdminUserInput({ email: 'not-an-email' })
    ).toThrow(/valid email/);
    expect(parseCreateAdminUserInput({ email: 'admin@example.com' })).toEqual({
      email: 'admin@example.com',
      name: null,
    });
  });

  it('listAdminUsers serializes createdAt', async () => {
    prisma.user.findMany.mockResolvedValue([
      {
        id: 'u1',
        email: 'admin@example.com',
        name: 'Admin',
        role: 'admin',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        emailVerified: true,
      },
    ]);

    const users = await listAdminUsers();

    expect(users[0].createdAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('getAdminUser returns null when missing', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    expect(await getAdminUser('missing')).toBeNull();
  });

  it('createAdminStaffUser rejects duplicate email', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1' });

    await expect(
      createAdminStaffUser({ email: 'staff@example.com' })
    ).rejects.toMatchObject({ code: 'EMAIL_TAKEN' });
  });

  it('createAdminStaffUser creates staff account', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'u2',
      email: 'staff@example.com',
      name: 'staff@example.com',
      role: 'staff',
      createdAt: new Date('2026-01-02T00:00:00.000Z'),
      emailVerified: false,
    });
    prisma.account.create.mockResolvedValue({});

    const result = await createAdminStaffUser({ email: 'staff@example.com' });

    expect(result.temporaryPassword).toBe('ChangeMe123!');
    expect(result.user.role).toBe('staff');
    expect(prisma.account.create).toHaveBeenCalledOnce();
  });

  it('updateAdminUserRole returns 404 when user missing', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      updateAdminUserRole('missing', 'admin')
    ).rejects.toMatchObject({ code: 'USER_NOT_FOUND', status: 404 });
  });

  it('updateAdminUserRole updates role', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
    prisma.user.update.mockResolvedValue({
      id: 'u1',
      email: 'staff@example.com',
      name: 'Staff',
      role: 'admin',
      createdAt: new Date('2026-01-02T00:00:00.000Z'),
      emailVerified: true,
    });

    const user = await updateAdminUserRole('u1', 'admin');

    expect(user.role).toBe('admin');
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { role: 'admin' },
      select: expect.any(Object),
    });
  });
});
