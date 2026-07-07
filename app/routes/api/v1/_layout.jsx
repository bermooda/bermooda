// Parent layout for /api/v1/* — enforces public API rate limits.

import { Outlet } from 'react-router';

import { rateLimitMiddleware } from '#/libs/rate-limit.server';

export const middleware = [rateLimitMiddleware('api-public')];

export default function ApiV1LayoutRoute() {
  return <Outlet />;
}
