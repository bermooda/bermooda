# Subscriptions and POS evaluation

bermooda now includes foundation modules for recurring billing and in-store sales. Full parity with Shopify Subscriptions or Shopify POS is **not** claimed — these are extensible starting points.

## Subscriptions

- **Schema:** `SubscriptionPlan`, `Subscription` in [`prisma/schema.prisma`](../prisma/schema.prisma)
- **Core:** [`app/core/subscriptions/index.server.js`](../app/core/subscriptions/index.server.js)
- **Admin API:** `GET/POST /api/admin/v1/subscriptions/plans`

### Recommended next steps for production subscriptions

1. Extend Stripe provider with `mode: 'subscription'` Checkout Sessions
2. Map `checkout.session.completed` webhooks to `createSubscription()`
3. Add customer account UI for manage/cancel
4. Support dunning and failed payment retries

## POS (point of sale)

- **Schema:** `PosSession`, `PosOrder`
- **Core:** [`app/core/pos/index.server.js`](../app/core/pos/index.server.js)
- **Admin API:** `POST /api/admin/v1/pos` with intents `openSession`, `closeSession`, `createDraftOrder`

### Recommended next steps for production POS

1. Barcode/SKU scanner UI for staff
2. Link POS draft completion to `placeOrder()` with `manual` payment
3. Cash drawer and receipt printing
4. Offline queue for flaky networks

## When to prioritize

| Merchant segment          | Priority                          |
| ------------------------- | --------------------------------- |
| DTC physical goods        | Subscriptions lower; POS optional |
| Consumables / SaaS hybrid | Subscriptions high                |
| Retail + online           | POS high                          |

See the feature gap plan for full competitor comparison.
