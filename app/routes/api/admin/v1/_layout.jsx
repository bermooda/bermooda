// Parent layout for /api/admin/v1/* — enforces admin API rate limits and API key auth.

import { Outlet } from 'react-router';

import { adminApiAuditMiddleware } from '#/libs/auth/api/audit.server';
import { adminApiKeyMiddleware } from '#/libs/auth/api/index.server';
import { rateLimitMiddleware } from '#/libs/rate-limit.server';

export const middleware = [
  rateLimitMiddleware('api-admin'),
  adminApiKeyMiddleware,
  adminApiAuditMiddleware,
];

export default function AdminApiV1LayoutRoute() {
  return <Outlet />;
}
