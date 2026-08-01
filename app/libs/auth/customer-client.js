import { createAuthClient } from 'better-auth/react';

import config from '#/libs/config';
import { getAuthClientBaseUrl } from '#/libs/auth/client-base';

export const customerAuthClient = createAuthClient({
  baseURL: getAuthClientBaseUrl(),
  basePath: config.auth.customerBasePath,
});
