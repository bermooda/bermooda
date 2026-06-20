// Parent layout for /api/v1/* — enforces public API rate limits.

import { Outlet } from 'react-router';

import { enforcePublicApiRateLimit } from '#/libs/auth/api.server';

export async function loader({ request }) {
  enforcePublicApiRateLimit(request);
  return null;
}

export default function ApiV1LayoutRoute() {
  return <Outlet />;
}
