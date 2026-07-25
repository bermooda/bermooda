import { createAuthClient } from 'better-auth/react';

import config from '#bermooda.config';
import { getAuthClientBaseUrl } from '#/libs/auth/client-base';

export const customerAuthClient = createAuthClient({
  baseURL: getAuthClientBaseUrl(),
  basePath: config.auth.customerBasePath,
});
