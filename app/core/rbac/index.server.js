// app/core/rbac/index.server.js
// Granular role-based access control for admin users and API keys.

import prisma from '#/libs/prisma.server';

/** @typedef {'read' | 'write' | 'delete' | 'manage'} PermissionAction */

const ADMIN_WILDCARD = '*';

const FALLBACK_PERMISSIONS = {
  admin: [ADMIN_WILDCARD],
  staff: [
    'dashboard:read',
    'reports:read',
    'products:read',
    'products:write',
    'categories:read',
    'categories:write',
    'pages:read',
    'pages:write',
    'menus:read',
    'menus:write',
    'reviews:read',
    'reviews:write',
    'orders:read',
    'orders:write',
    'customers:read',
    'customers:write',
    'customer-groups:read',
    'price-lists:read',
    'inventory:read',
    'inventory:write',
    'gift-cards:read',
    'loyalty:read',
    'loyalty:write',
    'marketing:read',
    'marketing:write',
    'channels:read',
    'channels:write',
    'discounts:read',
    'discounts:write',
    'returns:read',
    'returns:write',
    'shipments:read',
    'shipments:write',
    'media:read',
    'media:write',
    'plugins:read',
    'themes:read',
    'audit-log:read',
    'exports:read',
  ],
};

let _permissionCache = null;
let _cacheLoadedAt = 0;
const CACHE_TTL_MS = 60_000;

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

  for (const [role, permissions] of Object.entries(FALLBACK_PERMISSIONS)) {
    if (!map[role] || map[role].size === 0) {
      map[role] = new Set(permissions);
    }
  }

  _permissionCache = map;
  _cacheLoadedAt = now;
  return map;
}

/**
 * Seed default role permissions when the table is empty.
 */
export async function seedRolePermissions() {
  const count = await prisma.rolePermission.count();
  if (count > 0) return;

  const rows = [];
  for (const [role, permissions] of Object.entries(FALLBACK_PERMISSIONS)) {
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
 * Assert permission or throw a Response/Error suitable for routes.
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
 * Map an admin API path segment to a required permission.
 *
 * @param {string} resource
 * @param {string} method
 */
export function resolveApiPermission(resource, method) {
  const writeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
  const action = writeMethods.has(method.toUpperCase()) ? 'write' : 'read';
  return `${resource}:${action}`;
}

/** Test-only reset. */
export function __resetPermissionCache() {
  _permissionCache = null;
  _cacheLoadedAt = 0;
}
