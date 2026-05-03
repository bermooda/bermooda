import { Checkout } from '@polar-sh/remix';

import config from '#/config';

const POLAR_API_KEY = process.env.POLAR_API_KEY;

export const loader = Checkout({
  accessToken: POLAR_API_KEY,
  successUrl: `${config.baseUrl}/checkout/successful`,
  server: process.env.NODE_ENV === 'development' ? 'sandbox' : 'production',
});
