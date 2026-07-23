// app/core/rbac/index.server.js
// Granular role-based access control for admin users and API keys.

import bcrypt from 'bcryptjs';

import { isValidEmail, normalizeEmail } from '#/utils/email';
import prisma from '#/libs/prisma.server';
import { DEFAULT_MAX_LIST_RESULTS } from '#/libs/prisma/pagination/index.server';
import {
  ADMIN_ROLES,
  ADMIN_WILDCARD,
  DEFAULT_ROLE_PERMISSIONS,
} from '#/core/rbac/defaults';

export {
  ADMIN_ROLES,
  ADMIN_WILDCARD,
  DEFAULT_ROLE_PERMISSIONS,
  SETTINGS_MANAGE_PERMISSION,
} from '#/core/rbac/defaults';

/** @typedef {'read' | 'write' | 'delete' | 'manage'} PermissionAction */

const CACHE_TTL_MS = 60_000;
const STAFF_TEMP_PASSWORD = 'ChangeMe123!';

let _permissionCache = null;
let _cacheLoadedAt = 0;

function permissionKey(resource, action) {
  return `${resource}:${action}`;
}

function parsePermission(permission) {
  const [resource, action] = permission.split(':');
  if (!resource || !action) {
    throw new Error(`Invalid permission "${permission}"`);
  }
  return { resource, action };
}

function serializeAdminUser(user) {
  return {
    ...user,
    createdAt: user.createdAt?.toISOString?.() ?? user.createdAt,
  };
}

async function loadRolePermissions() {
  const now = Date.now();
  if (_permissionCache && now - _cacheLoadedAt < CACHE_TTL_MS) {
    return _permissionCache;
  }

  const rows = await prisma.rolePermission.findMany();
  const map = { admin: new Set(), staff: new Set() };

  for (const row of rows) {
    if (!map[row.role]) map[row.role] = new Set();
    map[row.role].add(permissionKey(row.resource, row.action));
  }

  for (const [role, permissions] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
    if (!map[role] || map[role].size === 0) {
      map[role] = new Set(permissions);
    }
  }

  _permissionCache = map;
  _cacheLoadedAt = now;
  return map;
}

/**
 * Validate an admin role string.
 *
 * @param {unknown} role
 * @returns {string}
 */
export function parseAdminRole(role) {
  const value = role?.toString().trim();
  if (!value || !ADMIN_ROLES.includes(value)) {
    throw Object.assign(new Error('Invalid admin role'), {
      code: 'ROLE_INVALID',
    });
  }
  return value;
}

/**
 * Seed default role permissions when the table is empty.
 */
export async function seedRolePermissions() {
  const count = await prisma.rolePermission.count();
  if (count > 0) return;

  const rows = [];
  for (const [role, permissions] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
    if (role === 'admin') continue;
    for (const permission of permissions) {
      const { resource, action } = parsePermission(permission);
      rows.push({ role, resource, action });
    }
  }

  if (rows.length > 0) {
    await prisma.rolePermission.createMany({ data: rows });
  }

  _permissionCache = null;
}

/**
 * List default and persisted permissions grouped by role.
 *
 * @returns {Promise<Record<string, string[]>>}
 */
export async function listRolePermissions() {
  const map = await loadRolePermissions();
  return Object.fromEntries(
    Object.entries(map).map(([role, permissions]) => [
      role,
      [...permissions].sort(),
    ])
  );
}

/**
 * Check whether a role has the given permission.
 *
 * @param {string} role
 * @param {string} permission - e.g. "products:write"
 */
export async function hasPermission(role, permission) {
  const map = await loadRolePermissions();
  const roleSet = map[role] ?? new Set();
  if (roleSet.has(ADMIN_WILDCARD)) return true;
  return roleSet.has(permission);
}

/**
 * Assert permission or throw a structured error suitable for routes.
 *
 * @param {{ role: string }} user
 * @param {string} permission
 */
export async function requirePermission(user, permission) {
  const allowed = await hasPermission(user.role, permission);
  if (!allowed) {
    const err = new Error('Forbidden');
    err.status = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }
}

/**
 * List admin/staff users for the settings page and admin API.
 *
 * @returns {Promise<object[]>}
 */
export async function listAdminUsers() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'asc' },
    take: DEFAULT_MAX_LIST_RESULTS,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      emailVerified: true,
    },
  });

  return users.map(serializeAdminUser);
}

/**
 * Get a single admin/staff user by id.
 *
 * @param {string} id
 * @returns {Promise<object|null>}
 */
export async function getAdminUser(id) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      emailVerified: true,
    },
  });

  return user ? serializeAdminUser(user) : null;
}

/**
 * Parse create-admin-user input from forms or API payloads.
 *
 * @param {object} input
 * @returns {{ email: string, name: string|null }}
 */
export function parseCreateAdminUserInput(input = {}) {
  const email = normalizeEmail(input.email);
  const name = input.name?.toString().trim() || null;

  if (!email) {
    throw Object.assign(new Error('Email is required'), {
      code: 'EMAIL_REQUIRED',
    });
  }

  if (!isValidEmail(email)) {
    throw Object.assign(new Error('Enter a valid email address'), {
      code: 'EMAIL_INVALID',
    });
  }

  return { email, name };
}

/**
 * Create a new staff admin user with a temporary password.
 *
 * @param {{ email: string, name?: string|null }} input
 * @returns {Promise<{ user: object, temporaryPassword: string }>}
 */
export async function createAdminStaffUser(input) {
  const { email, name } = parseCreateAdminUserInput(input);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw Object.assign(new Error('A user with that email already exists'), {
      code: 'EMAIL_TAKEN',
    });
  }

  const hashedPassword = await bcrypt.hash(STAFF_TEMP_PASSWORD, 10);
  const user = await prisma.user.create({
    data: {
      email,
      name: name || email,
      role: 'staff',
      emailVerified: false,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      emailVerified: true,
    },
  });

  await prisma.account.create({
    data: {
      accountId: user.id,
      providerId: 'credential',
      userId: user.id,
      password: hashedPassword,
    },
  });

  return {
    user: serializeAdminUser(user),
    temporaryPassword: STAFF_TEMP_PASSWORD,
  };
}

/**
 * Update an admin/staff user's role.
 *
 * @param {string} userId
 * @param {unknown} role
 * @returns {Promise<object>}
 */
export async function updateAdminUserRole(userId, role) {
  if (!userId?.toString().trim()) {
    throw Object.assign(new Error('userId is required'), {
      code: 'USER_ID_REQUIRED',
    });
  }

  const nextRole = parseAdminRole(role);
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  if (!existing) {
    throw Object.assign(new Error('Admin user not found'), {
      code: 'USER_NOT_FOUND',
      status: 404,
    });
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: { role: nextRole },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      emailVerified: true,
    },
  });

  return serializeAdminUser(user);
}

/** Test-only reset. */
export function __resetPermissionCache() {
  _permissionCache = null;
  _cacheLoadedAt = 0;
}
