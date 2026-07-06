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

Every `/api/admin/v1/*` endpoint requires an `admin`-scoped API key in the `Authorization` header:

```
Authorization: Bearer berm_<your_key>
```

**Creating a key:** Go to **Admin → API** and create a key there. Keys are shown once — store them securely. Only the SHA-256 hash is persisted.

**Scopes:**

- `admin` — access to `/api/admin/v1/*`
- `storefront` — reserved for future storefront-scoped credentials

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

All endpoints require `Authorization: Bearer berm_<key>` with `admin` scope.

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

---

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

#### `GET /api/admin/v1/audit-logs`

List audit log entries with pagination. Also returns `supportedEvents` (domain events recorded by the system subscriber).

**Query params:** `page` (default 1), `limit` (default 50, max 100), `action`, `entityType`, `actorId`

#### `GET /api/admin/v1/audit-logs/:id`

Get a single audit log entry.

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

List all API keys (key hashes are never returned).

> API key creation and revocation are managed through the admin UI at `/admin/api-settings` to prevent bootstrap circular dependency.

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
