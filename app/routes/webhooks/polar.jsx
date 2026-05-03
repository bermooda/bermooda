import { Webhooks } from '@polar-sh/remix';

import { handleOrderCreated, handleOrderPaid } from '#/services/polar.server';

const POLAR_WEBHOOK_SECRET = process.env.POLAR_WEBHOOK_SECRET;

export const action = Webhooks({
  webhookSecret: POLAR_WEBHOOK_SECRET,
  onOrderCreated: handleOrderCreated,
  onOrderPaid: handleOrderPaid,
});
