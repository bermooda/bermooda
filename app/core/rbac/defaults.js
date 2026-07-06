// app/core/rbac/defaults.js
// Canonical admin roles and default staff permissions.

export const ADMIN_WILDCARD = '*';

export const ADMIN_ROLES = ['admin', 'staff'];

export const SETTINGS_MANAGE_PERMISSION = 'settings:manage';

export const DEFAULT_ROLE_PERMISSIONS = {
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
