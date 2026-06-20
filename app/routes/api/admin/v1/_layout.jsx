// Parent layout for /api/admin/v1/* — enforces admin API rate limits.

import { Outlet } from 'react-router';

import { enforceRateLimit } from '#/libs/rate-limit.server';

export async function loader({ request }) {
  enforceRateLimit(request, 'api-admin');
  return null;
}

export default function AdminApiV1LayoutRoute() {
  return <Outlet />;
}
