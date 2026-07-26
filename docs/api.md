# bermooda REST API

This document describes the public REST API introduced in W2. The API is built now and will be promoted for general availability after W8 (rate limiting, RBAC, and Postgres hardening).

## Base URLs

| Audience   | Base URL        |
| ---------- | --------------- |
| Storefront | `/api/v1`       |
| Admin      | `/api/admin/v1` |

## Authentication

### Storefront API

Storefront catalog, search, cart, and checkout endpoints are **public** — no API key is required. Cart access is controlled by the cart token (a UUID returned when the cart is created).

### Admin API

Most `/api/admin/v1/*` endpoints require an Admin API key in the `Authorization` header:

```
Authorization: Bearer berm_<your_key>
```

**Bootstrap (no existing key):**

1. Prefer **CLI seed / `npm run cli:bootstrap`** — creates the first admin (if needed), marks setup complete, prints a one-time bootstrap `berm_` key, writes `.bermooda/bootstrap-api-key`, and may append `BERMOODA_API_KEY` to `.env`. Then run `bermooda mcp init` from [@bermooda/cli](https://github.com/bermooda/cli).
2. Or use the unauthenticated setup endpoints below with a one-shot `SETUP_TOKEN` (see `.env.example`).

**Creating additional keys:** `POST /api/admin/v1/api-keys` (requires an existing admin key), or **Admin → API**.

**Scopes:**

| Scope                                  | Access                                                                                                |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `admin`                                | Full Admin API (recommended for agents / MCP). Implies all granular scopes below except `storefront`. |
| `storefront`                           | Reserved for future storefront-scoped credentials                                                     |
| `settings:read` / `settings:write`     | Shop settings                                                                                         |
| `products:read` / `products:write`     | Catalog products                                                                                      |
| `categories:read` / `categories:write` | Categories                                                                                            |
| `orders:read` / `orders:write`         | Orders                                                                                                |
| `media:read` / `media:write`           | Media metadata + upload                                                                               |
| `inventory:read` / `inventory:write`   | Locations + inventory levels                                                                          |
| `webhooks:read` / `webhooks:write`     | Webhook subscriptions                                                                                 |
| `themes:write` / `plugins:write`       | Theme activate / plugin enable                                                                        |
| `audit:read`                           | Audit log read                                                                                        |
| `imports:write`                        | CSV imports                                                                                           |

Keys may call `/api/admin/v1` when they have `admin` or any granular admin-area scope. Individual routes may require a specific scope; `admin` always satisfies those checks.

### Setup endpoints (no API key)

These live under `/api/admin/v1/setup*` and are rate-limited but **not** API-key authenticated.

#### `GET /api/admin/v1/setup`

Bootstrap readiness snapshot: `onboardingAvailable`, `adminExists`, `adminSetupComplete`, `apiKeyCount`, `bootstrapApiKeyAvailable`, `setupTokenConfigured`.

#### `POST /api/admin/v1/setup/admin`

Create the first admin when onboarding is still available (same gate as the Admin UI).

**Body:** `{ "name": "...", "email": "...", "password": "...", "confirmPassword": "..." }` — `confirmPassword` defaults to `password` when omitted.

#### `POST /api/admin/v1/setup/api-key`

Create the **first** API key when none exist. Requires `SETUP_TOKEN` via `X-Setup-Token` or `Authorization: Bearer <SETUP_TOKEN>`. Returns `{ "key": "berm_...", "apiKey": { ... } }` once.

When `SETUP_TOKEN` is unset, use CLI seed/bootstrap instead.

## Error responses

All errors return JSON with a machine-readable `code` field:

```json
{ "error": "Invalid API key", "code": "KEY_INVALID" }
```

| HTTP status | Meaning                               |
| ----------- | ------------------------------------- |
| 400         | Bad request (missing or invalid body) |
| 401         | Missing or invalid API key            |
| 403         | API key lacks the required scope      |
| 404         | Resource not found                    |
| 405         | Method not allowed                    |
| 422         | Business logic error (see `code`)     |

---

## Storefront API (`/api/v1`)

### Catalog

#### `GET /api/v1/catalog`

List published products.

**Query params:** `page`, `limit` (max 100), `locale`, `currency`, `categoryId`

**Response:**

```json
{
  "products": [...],
  "total": 42,
  "page": 1,
  "limit": 20
}
```

#### `GET /api/v1/catalog/:id`

Get a single product by id.

**Query params:** `locale`, `currency`

---

### Categories

#### `GET /api/v1/categories`

List all categories.

**Query params:** `locale`

---

### Search

#### `GET /api/v1/search`

Search products.

**Query params:** `q`, `page`, `limit`, `locale`, `currency`, `categoryId`, `sortBy`, `sortDir`

---

### Product reviews

#### `GET /api/v1/products/:productId/reviews`

List approved reviews for a product.

**Query params:** `page` (default 1), `limit` (default 10, max 100)

**Response:**

```json
{
  "reviews": [...],
  "total": 12,
  "page": 1,
  "limit": 10,
  "totalPages": 2
}
```

#### `POST /api/v1/products/:productId/reviews`

Submit a product review (status starts as `pending` until moderated).

**Body:** `{ "customerId": "...", "rating": 5, "title": "Optional", "body": "Great product" }`

**Response:** `201` with `{ "review": { ... } }`

---

### Cart

#### `POST /api/v1/cart`

Create a new cart.

**Body:**

```json
{ "currency": "USD", "customerId": "optional" }
```

**Response:** `201` with `{ "cart": { ... } }`

#### `GET /api/v1/cart/:token`

Get a cart by its token.

#### `DELETE /api/v1/cart/:token`

Delete a cart.

#### `POST /api/v1/cart/:token/lines`

Add a line to the cart.

**Body:**

```json
{ "variantId": "cld...", "quantity": 2, "currency": "USD" }
```

#### `PATCH /api/v1/cart/:token/lines/:lineId`

Update a line's quantity.

**Body:** `{ "quantity": 3 }` — set to `0` or negative to remove.

#### `DELETE /api/v1/cart/:token/lines/:lineId`

Remove a line from the cart.

---

### Checkout

#### `POST /api/v1/checkout`

Create a checkout session from a cart.

**Body:**

```json
{
  "cartToken": "uuid...",
  "email": "guest@example.com",
  "customerId": "optional"
}
```

**Response:** `201` with `{ "session": { ... } }`

#### `GET /api/v1/checkout/:id`

Get a checkout session.

#### `POST /api/v1/checkout/:id/update`

Update checkout session fields (address, shipping option, payment provider, tenders, etc.). Pass a full payload with `shippingAddressJson`, `shippingOptionJson`, and `paymentProvider` to validate a complete checkout before order placement.

---

## Admin API (`/api/admin/v1`)

Authenticated endpoints require `Authorization: Bearer berm_<key>` with `admin` scope. Setup routes are listed under Authentication above.

### Settings

#### `GET /api/admin/v1/settings`

Shop settings snapshot: general, currencies, locales, tax, shipping zones, SEO, address validation.

#### `PATCH /api/admin/v1/settings`

Update **one section per request**.

**Body examples:**

```json
{ "general": { "shopName": "Acme", "contactEmail": "hello@acme.test" } }
{ "currencies": { "defaultCurrency": "USD", "currencies": ["USD", "EUR"] } }
{ "locales": { "defaultLocale": "en", "locales": ["en", "de"] } }
{ "tax": { "mode": "exclusive", "regions": [] } }
{ "shipping": { "zones": [] } }
{ "seo": { "metaTitle": "Acme Shop" } }
{ "addressValidation": { "provider": "noop" } }
```

Theme activation and plugin enablement use dedicated `/themes` and `/plugins` routes (not settings PATCH).

### Themes

#### `GET /api/admin/v1/themes`

List registered themes, active theme id/manifest, and active theme settings values.

#### `PATCH /api/admin/v1/themes`

Activate a theme and/or save settings for the active theme.

```json
{ "themeId": "@bermooda/theme-default" }
{ "settings": { "someKey": "value" } }
```

### Plugins

#### `GET /api/admin/v1/plugins`

List registered plugins, enabled ids, display order, and per-plugin settings.

#### `PATCH /api/admin/v1/plugins`

Enable/disable, reorder, and/or save settings.

```json
{ "pluginId": "@bermooda/sample-analytics", "enabled": true }
{ "order": ["@bermooda/sample-analytics"] }
{ "pluginId": "@bermooda/sample-analytics", "settings": { "apiKey": "..." } }
```

### Categories

#### `GET /api/admin/v1/categories`

List category tree. Query: `locale`.

#### `POST /api/admin/v1/categories`

Create a category.

**Body:** `{ "title": "Shirts", "slug": "shirts", "locale": "en", "parentId": null, "position": 0 }` — `name` is accepted as an alias for `title`.

#### `GET /api/admin/v1/categories/:id`

Get a category (with children/products). Query: `locale`.

#### `PATCH /api/admin/v1/categories/:id`

Update title/slug/parent/position.

#### `DELETE /api/admin/v1/categories/:id`

Recursively delete a category and its descendants.

### Products

#### `GET /api/admin/v1/products`

List products (all — including unpublished).

**Query params:** `page`, `limit`, `locale`, `currency`, `categoryId`, `published`

#### `POST /api/admin/v1/products`

Create a product. See `app/core/catalog/index.server.js` for the accepted shape.

#### `GET /api/admin/v1/products/:id`

Get a product by id.

#### `PATCH /api/admin/v1/products/:id`

Update a product.

#### `DELETE /api/admin/v1/products/:id`

Delete a product.

### Collections

#### `GET /api/admin/v1/collections` / `POST /api/admin/v1/collections`

List or create collections. Query: `page`, `limit`, `q`, `published`.

#### `GET|PATCH|DELETE /api/admin/v1/collections/:id`

Get, update, or delete a collection.

### Imports

#### `POST /api/admin/v1/imports`

Import products from CSV (multipart or JSON payload — see route module).

### Inventory

#### `GET /api/admin/v1/inventory/locations`

List locations with inventory levels.

#### `POST /api/admin/v1/inventory/locations`

Create a location. Body: `{ "name": "Warehouse", "code": "WH1", "allowsPickup": false }`.

#### `PUT /api/admin/v1/inventory/levels`

Set stock for a variant at a location. Requires `inventory:write` (or `admin`).

**Body:** `{ "variantId": "…", "locationId": "…", "quantity": 10 }`

### Orders

#### `GET /api/admin/v1/orders`

List orders.

**Query params:** `page`, `limit`, `status`, `customerId`

#### `GET /api/admin/v1/orders/:id`

Get a single order with lines, shipments, and refunds.

#### `PATCH /api/admin/v1/orders/:id`

Update order status.

**Body:** `{ "status": "confirmed" }`

Valid statuses: `pending`, `confirmed`, `paid`, `fulfilled`, `cancelled`, `refunded`.

#### `POST /api/admin/v1/orders/:id/refunds`

Create a refund.

**Body:** `{ "amountCents": 1000, "reason": "Customer request", "providerRefundId": "optional" }`

#### `POST /api/admin/v1/orders/:id/shipments`

Create a shipment.

**Body:** `{ "carrier": "FedEx", "trackingNumber": "...", "trackingUrl": "..." }`

#### `POST /api/admin/v1/orders/:id/returns`

Create a return request for an order.

**Body:** `{ "reason": "Damaged item", "lines": [{ "orderLineId": "...", "quantity": 1 }] }`

#### `GET /api/admin/v1/returns`

List returns with pagination. Also returns `returnStatuses` and `returnResolutions`.

**Query params:** `page`, `limit`, `status`, `orderId`, `customerId`

#### `GET /api/admin/v1/returns/:id`

Get a single return with lines and order summary.

#### `POST /api/admin/v1/returns/:id/approve`

Approve a requested return.

**Body:** `{ "resolution": "refund" }` — optional; defaults to `refund`.

#### `POST /api/admin/v1/returns/:id/receive`

Mark an approved return as received and restock inventory.

#### `POST /api/admin/v1/returns/:id/complete`

Complete a received return with refund, store credit, or exchange.

**Body:** `{ "resolution": "refund", "refundAmountCents": 1000 }` — `refundAmountCents` is optional; defaults to line totals.

#### `POST /api/admin/v1/returns/:id/cancel`

Cancel a return before it is received.

---

### Reviews

#### `GET /api/admin/v1/reviews`

List reviews with pagination. Also returns `reviewStatuses`.

**Query params:** `page`, `limit`, `status` (`pending`, `approved`, `rejected`, or `all`), `productId`, `customerId`

#### `GET /api/admin/v1/reviews/:id`

Get a single review with product title and customer summary.

#### `PATCH /api/admin/v1/reviews/:id`

Moderate a review.

**Body:** `{ "status": "approved" }` — one of `pending`, `approved`, or `rejected`.

#### `DELETE /api/admin/v1/reviews/:id`

Delete a review permanently.

---

### Customers

#### `GET /api/admin/v1/customers`

List customers.

**Query params:** `page`, `limit`

#### `GET /api/admin/v1/customers/:id`

Get a customer with addresses.

#### `PATCH /api/admin/v1/customers/:id`

Update customer details.

**Body:** `{ "name": "Jane Doe", "phone": "+1555...", "preferredLocale": "en" }`

#### `GET /api/admin/v1/customers/:id/consent`

Get parsed consent flags and erasure state for a customer.

#### `PATCH /api/admin/v1/customers/:id/consent`

Update stored consent preferences.

**Body:** `{ "analytics": true, "marketing": false }` — include only fields to change.

#### `GET /api/admin/v1/customers/:id/data-export`

Export all personal data for a customer as a portable JSON bundle.

#### `POST /api/admin/v1/customers/:id/erase`

Anonymize a customer's personal data while preserving order history. Returns `{ customerId, anonymizedEmail }`. Responds with `409` when the customer was already erased.

---

### Admin users

#### `GET /api/admin/v1/admin-users`

List admin and staff users.

#### `GET /api/admin/v1/admin-users/:id`

Get an admin/staff user.

#### `PATCH /api/admin/v1/admin-users/:id`

Update an admin/staff user's role.

**Body:** `{ "role": "admin" }` or `{ "role": "staff" }`

---

### Audit log

Successful Admin API mutations (non-GET) are recorded with `actorType: api_key` (API key id / label). Admin UI mutations use `actorType: admin`. Domain events use `actorType: system`.

#### `GET /api/admin/v1/audit-logs`

List audit log entries with pagination. Also returns `supportedEvents` (domain events recorded by the system subscriber).

**Query params:** `page` (default 1), `limit` (default 50, max 100), `action`, `entityType`, `actorId`

#### `GET /api/admin/v1/audit-logs/:id`

Get a single audit log entry.

---

### Media

#### `POST /api/admin/v1/media`

Upload a file (`multipart/form-data`, field `file`). Requires `media:write` (or `admin`). Returns `{ media }` (201).

#### `GET /api/admin/v1/media/:id`

Get media metadata. Requires `media:read` (or `admin`).

---

### Discounts

#### `GET /api/admin/v1/discounts`

List discounts.

**Query params:** `page`, `limit`, `active`

#### `POST /api/admin/v1/discounts`

Create a discount.

#### `GET /api/admin/v1/discounts/:id`

Get a discount by id.

#### `PATCH /api/admin/v1/discounts/:id`

Update a discount.

#### `DELETE /api/admin/v1/discounts/:id`

Delete a discount.

---

### API Keys

#### `GET /api/admin/v1/api-keys`

List all API keys (key hashes are never returned). Query: `page`, `limit`.

#### `POST /api/admin/v1/api-keys`

Create an API key. The raw `key` is returned **once**.

**Body:** `{ "label": "CI", "scopes": ["admin"], "expiresAt": null }`

#### `GET /api/admin/v1/api-keys/:id`

Get an API key metadata record.

#### `DELETE /api/admin/v1/api-keys/:id`

Revoke (permanently delete) an API key.

For the **first** key with no existing credentials, use CLI seed/bootstrap or `POST /api/admin/v1/setup/api-key`.

---

### Webhook Subscriptions

#### `GET /api/admin/v1/webhook-subscriptions`

List webhook subscriptions with pagination. Also returns `supportedEvents`.

Query params: `page` (default 1), `limit` (default 50, max 100).

#### `POST /api/admin/v1/webhook-subscriptions`

Create a webhook subscription.

**Body:**

```json
{
  "url": "https://example.com/webhook",
  "events": ["order.created", "payment.refunded"],
  "secret": "whsec_your_secret_here",
  "label": "My ERP"
}
```

Use `"*"` in the `events` array to receive all domain events.

#### `GET /api/admin/v1/webhook-subscriptions/:id`

Get a subscription plus its recent delivery history.

#### `PATCH /api/admin/v1/webhook-subscriptions/:id`

Update a subscription. Supported fields: `active`, `label`, `url`, `events`, `secret`.

#### `DELETE /api/admin/v1/webhook-subscriptions/:id`

Delete a webhook subscription and all its delivery records.

---

### Marketing

#### `GET /api/admin/v1/marketing/segments`

List marketing segments with pagination.

Query params: `page` (default 1), `limit` (default 50, max 100).

#### `POST /api/admin/v1/marketing/segments`

Create a marketing segment.

```json
{
  "name": "VIP customers",
  "rules": {
    "minOrders": 3,
    "minSpentCents": 10000,
    "customerGroupId": "..."
  }
}
```

#### `GET /api/admin/v1/marketing/segments/:id`

Get a segment by id (includes parsed `rules`).

#### `PATCH /api/admin/v1/marketing/segments/:id`

Update a segment name and/or rules.

#### `DELETE /api/admin/v1/marketing/segments/:id`

Delete a segment and its campaigns.

#### `GET /api/admin/v1/marketing/campaigns`

List email campaigns with pagination.

#### `POST /api/admin/v1/marketing/campaigns`

Create a campaign for a segment.

```json
{
  "segmentId": "...",
  "name": "Summer sale",
  "subject": "Don't miss out",
  "bodyHtml": "<p>Hi {{name}}, ...</p>"
}
```

#### `GET /api/admin/v1/marketing/campaigns/:id`

Get a campaign by id.

#### `POST /api/admin/v1/marketing/campaigns/:id/send`

Send a draft or scheduled campaign to matching segment customers with marketing consent.

#### `GET /api/admin/v1/marketing/abandoned-cart-sequences`

List abandoned-cart sequence steps with pagination.

#### `POST /api/admin/v1/marketing/abandoned-cart-sequences`

Create a sequence step.

```json
{
  "name": "First reminder",
  "stepNumber": 1,
  "delayMinutes": 60,
  "subject": "You left items in your cart"
}
```

#### `GET /api/admin/v1/marketing/abandoned-cart-sequences/:id`

Get a sequence step by id.

#### `PATCH /api/admin/v1/marketing/abandoned-cart-sequences/:id`

Update a sequence step (including `active` toggle).

#### `POST /api/admin/v1/marketing/abandoned-cart-sequences/run`

Queue abandoned-cart sequence processing. Returns `{ queued: true }` with status 202.

---

### Reports

Shared query params (where relevant): `startDate`, `endDate` (ISO date `YYYY-MM-DD`), `limit` (default 20, max 100), `locale` (default shop locale).

Paid sales metrics use order statuses `paid`, `fulfilled`, and `refunded`.

#### `GET /api/admin/v1/reports/overview`

Overview KPIs for the range: revenue, paid/total orders, tax, discounts, refunds, AOV, checkout conversion.

**Response:** `{ "overview": { ... } }`

#### `GET /api/admin/v1/reports/sales-over-time`

Daily buckets: orders, revenue, tax, discounts.

**Response:** `{ "salesOverTime": [ ... ] }`

#### `GET /api/admin/v1/reports/sales-by-product`

Top products by revenue (`limit`).

**Response:** `{ "salesByProduct": [ ... ] }`

#### `GET /api/admin/v1/reports/sales-by-category`

Revenue by category (`limit`, titles honor `locale`).

**Response:** `{ "salesByCategory": [ ... ] }`

#### `GET /api/admin/v1/reports/ops`

Operational metrics: abandoned checkouts and recent orders (date-ranged); low stock count + sample variants (current snapshot).

**Response:** `{ "ops": { "range", "asOf", "abandonedCheckouts", "recentOrders", "lowStock" } }`

#### `GET /api/admin/v1/reports/customers`

Customer analytics for the range: new customers, returning customers, paid orders split new vs returning, top customers by revenue.

Guest orders (no `customerId`) are excluded from order-based metrics.

**Response:** `{ "customers": { ... } }`

#### `GET /api/admin/v1/reports/inventory`

Snapshot inventory analytics: low stock, out of stock, stock value, by location.

Optional query: `currency` (default shop default), `threshold` (default 5). Date params are ignored.

**Response:** `{ "inventory": { ... } }`

#### `GET /api/admin/v1/reports/exports`

Scheduled export health: schedule counts, recent runs (no CSV body), failure rate in range.

**Response:** `{ "exports": { ... } }`

#### `GET /api/admin/v1/reports/dashboard`

Composed payload: overview, salesOverTime, salesByProduct, salesByCategory, and ops.

**Response:** `{ "report": { ... } }`

---

### Scheduled exports

#### `GET /api/admin/v1/scheduled-exports`

List scheduled CSV exports with pagination. Also returns `exportTypes` and `exportSchedules`.

Query params: `page` (default 1), `limit` (default 50, max 100).

#### `POST /api/admin/v1/scheduled-exports`

Create a scheduled export.

**Body:**

```json
{
  "label": "Weekly orders",
  "exportType": "orders",
  "schedule": "weekly",
  "recipientEmail": "ops@example.com",
  "filters": { "startDate": "2026-01-01", "endDate": "2026-01-31" }
}
```

#### `GET /api/admin/v1/scheduled-exports/:id`

Get a scheduled export plus its recent runs.

#### `DELETE /api/admin/v1/scheduled-exports/:id`

Delete a scheduled export.

#### `POST /api/admin/v1/scheduled-exports/:id/run`

Queue an immediate run of a scheduled export.

#### `GET /api/admin/v1/export-runs/:id`

Get export run metadata. Pass `includeContent=true` to include the CSV payload.

---

### Other admin resources

Also registered (see route modules under `app/routes/api/admin/v1/`):

| Resource                             | Notes                       |
| ------------------------------------ | --------------------------- |
| `pages`, `menus`                     | CMS content                 |
| `channels`, `companies`, `quotes`    | Channels / B2B              |
| `gift-cards`, `loyalty`, `wishlists` | Engagement                  |
| `pos`, `subscriptions` (+ plans)     | POS / subscriptions         |
| `storage`                            | Storage provider status     |
| `media`, `media/:id`                 | Upload + get media metadata |
| `address-validation/*`               | Providers + validate        |
| `back-in-stock-subscriptions`        | Waitlist management         |
| Order/shipment PDF documents         | Invoice + packing slip      |

---

## Outbound webhooks

### Payload format

Every delivery is a `POST` with `Content-Type: application/json`:

```json
{
  "event": "order.created",
  "data": { ... },
  "timestamp": "2026-06-19T04:00:00.000Z"
}
```

### Signature verification

Each request carries an `X-Bermooda-Signature: sha256=<hex>` header. Verify it by computing HMAC-SHA256 of the raw request body using your subscription secret:

```js
import { createHmac } from 'crypto';

function isValid(secret, rawBody, signatureHeader) {
  const expected =
    'sha256=' + createHmac('sha256', secret).update(rawBody).digest('hex');
  return signatureHeader === expected;
}
```

Additional headers: `X-Bermooda-Event`, `X-Bermooda-Delivery` (delivery id for idempotency).

### Retry policy

Failed deliveries are retried with exponential back-off:

| Attempt           | Delay      |
| ----------------- | ---------- |
| 1st retry         | 30 seconds |
| 2nd retry         | 2 minutes  |
| 3rd retry         | 10 minutes |
| 4th retry         | 30 minutes |
| 5th retry (final) | 2 hours    |

After 5 failed attempts the delivery is marked `failed` and no further retries are made.

### Supported events

| Event                | Emitted when                                  |
| -------------------- | --------------------------------------------- |
| `order.created`      | A new order is placed                         |
| `order.confirmed`    | Payment confirmed, order moves to `confirmed` |
| `order.cancelled`    | Order cancelled                               |
| `shipment.created`   | A shipment is added to an order               |
| `shipment.shipped`   | Shipment marked as shipped                    |
| `shipment.delivered` | Shipment marked as delivered                  |
| `payment.succeeded`  | Payment provider webhook confirms success     |
| `payment.failed`     | Payment provider webhook reports failure      |
| `payment.refunded`   | A refund is created                           |

---

## GA status

This API is **buildable now** but not recommended for production use until W8 ships rate limiting, granular RBAC, and Postgres support. Track progress in the execution plan.
