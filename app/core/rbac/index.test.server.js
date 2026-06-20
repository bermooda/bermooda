// app/core/rbac/index.test.server.js

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('#/libs/prisma.server', () => ({
  default: {
    rolePermission: {
      findMany: vi.fn(),
      count: vi.fn(),
      createMany: vi.fn(),
    },
  },
}));

import prisma from '#/libs/prisma.server';

import {
  __resetPermissionCache,
  hasPermission,
  seedRolePermissions,
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
});
