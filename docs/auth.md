# Authentication Architecture

bermooda uses a **dual-auth** design: two separate better-auth instances, each
with its own cookie namespace, base path, and Prisma model set. The two
instances share no session state and no cookies.

---

## Instances

### Admin auth

| Property      | Value                                        |
| ------------- | -------------------------------------------- |
| File          | `app/libs/auth/admin.server.js`              |
| Client file   | `app/libs/auth/admin-client.js`              |
| Base path     | `/admin/auth`                                |
| Cookie prefix | `bermooda_admin_`                            |
| Prisma models | `User`, `Session`, `Account`, `Verification` |
| Plugins       | `twoFactor`                                  |
| Callback URL  | `/admin/dashboard`                           |

Handles staff/admin logins. Maps to the standard better-auth model set
(`User`, `Session`, `Account`, `Verification`) that already exists in the
Prisma schema.

### Customer auth

| Property      | Value                                                                    |
| ------------- | ------------------------------------------------------------------------ |
| File          | `app/libs/auth/customer.server.js`                                       |
| Client file   | `app/libs/auth/customer-client.js`                                       |
| Base path     | `/account/auth`                                                          |
| Cookie prefix | `bermooda_customer_`                                                     |
| Prisma models | `Customer`, `CustomerSession`, `CustomerAccount`, `CustomerVerification` |
| Plugins       | none (twoFactor deferred)                                                |
| Callback URL  | `/account`                                                               |

Handles storefront customer logins. Uses better-auth's `modelName` option on
each table-level config block to redirect all DB operations to the `Customer*`
Prisma models:

```js
user: {
  modelName: 'Customer';
}
session: {
  modelName: 'CustomerSession';
}
account: {
  modelName: 'CustomerAccount';
}
verification: {
  modelName: 'CustomerVerification';
}
```

This is the supported approach in better-auth 1.6.x — there is no
`modelPrefix` shorthand on `prismaAdapter`; model remapping is done per-entity
via `BetterAuthDBOptions.modelName`.

> **Phase 2 note**: The `Customer*` Prisma tables do not exist yet. The
> configuration above compiles and the handler mounts at `/account/auth/*`.
> Actual DB operations against these tables require the Phase 2 schema
> migration (`prisma migrate dev`) that adds the four `Customer*` models.

---

## Cookie layout

Each instance writes its own cookies, completely independent of the other. The
table below shows what appears in the browser after a successful login to each
instance.

| Cookie name                 | Set by            | Path scope         | Domain scope |
| --------------------------- | ----------------- | ------------------ | ------------ |
| `bermooda_admin_session`    | admin instance    | `/admin/`          | current host |
| `bermooda_customer_session` | customer instance | `/` (account-wide) | current host |

- The admin instance base path is `/admin/auth`, so better-auth scopes its
  cookies to `/admin/`.
- The customer instance base path is `/account/auth`, but storefront pages live
  across `/account/` and `/` — cookies are effectively scoped to the root path
  `/` so they are sent with all storefront requests.
- Because the cookie **names** differ (different prefix), there is no collision
  even when both cookies are present on the same domain.
- The two instances share **zero cookie state**: reading a `bermooda_admin_*`
  cookie in the customer middleware (or vice versa) is not possible — each
  middleware only asks its own better-auth instance to validate, which only
  reads cookies belonging to that prefix.

---

## Route handlers

```
GET/POST  /auth/*          app/routes/auth/all.jsx       (legacy, index.server.js)
GET/POST  /admin/auth/*    app/routes/auth/admin.jsx     (adminAuth)
GET/POST  /account/auth/*  app/routes/auth/customer.jsx  (customerAuth)
```

Each file is a thin React Router route that proxies the request to the
corresponding better-auth handler:

```js
export async function loader({ request }) {
  return auth.handler(request);
}
export async function action({ request }) {
  return auth.handler(request);
}
```

---

## Route middleware

better-auth sessions are validated inside React Router middleware functions:

- **Admin routes** — wrap the admin layout with `adminAuthMiddleware` from
  `admin.server.js`. On success it sets `adminAuthContext` so child routes can
  read the current admin user via `useRouteLoaderData` / `context.get(adminAuthContext)`.

- **Customer routes** — wrap the account layout with `customerAuthMiddleware`
  from `customer.server.js`. On success it sets `customerAuthContext`.
  Unauthenticated requests are redirected to `/account/login`.

Both middleware functions follow the same pattern as the existing `authMiddleware`
in `index.server.js`.

---

## Client-side

| Import               | basePath        | Plugins           |
| -------------------- | --------------- | ----------------- |
| `adminAuthClient`    | `/admin/auth`   | `twoFactorClient` |
| `customerAuthClient` | `/account/auth` | none              |

Both clients derive `baseURL` from `window.location.origin` in the browser and
fall back to `config.baseUrl` on the server, matching the pattern in the
original `client.js`.

---

## Isolation guarantees

The two better-auth instances are completely independent JavaScript objects
created at module load time. Isolation is enforced at every layer:

**JavaScript-level isolation**

- `adminAuth` (from `admin.server.js`) and `customerAuth` (from
  `customer.server.js`) are separate object instances with separate internal
  state — no shared caches, no shared configuration, no shared in-memory data.

**Database-level isolation**

- Admin operations target `User`, `Session`, `Account`, and `Verification`
  Prisma models.
- Customer operations target `Customer`, `CustomerSession`,
  `CustomerAccount`, and `CustomerVerification` Prisma models.
- There is no foreign-key or join relationship between the two model sets.
  A customer row can never be confused for a user row at the ORM level.

**Cookie-level isolation**

- `adminAuthMiddleware` calls `adminAuth.api.getSession({ headers })`, which
  only reads `bermooda_admin_*` cookies from the request.
- `customerAuthMiddleware` calls `customerAuth.api.getSession({ headers })`,
  which only reads `bermooda_customer_*` cookies.
- Presenting a valid `bermooda_customer_session` cookie to an admin-protected
  route returns no session — the admin middleware sees no matching cookie and
  redirects to `/admin/login`. The reverse is equally true.

**Simultaneous sessions**

A browser can hold both a `bermooda_admin_session` and a
`bermooda_customer_session` cookie at the same time (e.g. a staff member with
an admin tab open and a storefront tab open). The two sessions are independent
and do not interfere. Logging out of one instance does not touch the other.

---

## Smoke test

Two auth instances compile and their handlers respond at separate base paths.

```
# Admin auth — should return a JSON response (e.g. 404 from better-auth)
curl -I http://localhost:3000/admin/auth/get-session

# Customer auth — should return a JSON response (e.g. 404 from better-auth)
curl -I http://localhost:3000/account/auth/get-session
```

Both endpoints should be reachable (HTTP 200 or better-auth's own 404/401),
confirming the two instances are independently mounted. Full end-to-end login
flows against the `Customer*` tables require the Phase 2 schema migration.

---

## Legacy auth instance

`app/libs/auth/index.server.js` (and its companion `app/libs/auth/client.js`)
is the original single better-auth instance. It is mounted at `/auth/*` via
`app/routes/auth/all.jsx` and remains in production for backward compatibility
(existing sessions, OAuth callbacks, third-party integrations that already use
the `/auth/` base path).

**New code should not add to this instance.** Use `admin.server.js` for
anything staff/admin-facing and `customer.server.js` for anything
storefront-facing. The legacy instance may be removed in a future phase once
all callers have been migrated.
