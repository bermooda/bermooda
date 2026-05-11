---
name: admin-onboarding
overview: Use `/admin` as the only public entry for first-time setup and sign-in. When no admin user exists, the same URL shows onboarding; when at least one admin exists, it shows the login flow. After setup, onboarding is permanently disabled; authenticated visits to `/admin` still redirect to the dashboard.
todos:
  - id: core-workflow
    content: Create tested server workflow for onboarding availability, validation, and first-admin creation
    status: completed
  - id: route-structure
    content: Unify `/admin` under public layout with loader branching (onboarding vs login) and remove separate onboarding URL
    status: completed
  - id: redirects
    content: After setup redirect to `/admin` with success signal; block onboarding when setup is complete or admins exist; keep auth redirect to dashboard
    status: completed
  - id: validate
    content: Run focused server tests and lint/format checks
    status: completed
isProject: false
---

# Admin Onboarding Plan

## Approach

- **Single URL:** First-time setup and admin sign-in both happen at `**/admin`\*\*. Do not add or use `/admin/onboarding` (or any other path for onboarding).
- **Loader-driven UI:** The `/admin` route loader decides what unauthenticated visitors see:
  1. **At least one admin user exists** (and onboarding is not “re-opened” by a bug) → render the **login** experience (reuse the same form, validation, and Better Auth behavior as today’s `/admin/login`, ideally via a shared component so logic stays DRY).
  2. **No admin user exists** → render **onboarding** (create first admin: name, email, password, confirm).
  3. **Session already has an authenticated admin** → **redirect to `/admin/dashboard`** (preserve today’s “land on dashboard” behavior for logged-in users).
- **Route tree:** Today `index('routes/admin/index.jsx')` sits under the authenticated admin layout and only redirects to the dashboard. **Move** that responsibility so `/admin` is handled under the **public** admin layout (`routes/admin/public/_layout.jsx`), where unauthenticated loaders are allowed. Remove the duplicate index from the authenticated layout (or leave only paths like `/admin/dashboard` under auth) so `/admin` is not registered twice.
- **Domain logic:** Keep create-first-admin rules in `[app/core/admin-onboarding/index.server.js](app/core/admin-onboarding/index.server.js)` (count admins / setup flag, validate input, bcrypt credential, mark setup complete). Do not put business rules only in the route file.
- **Security model:** While **no** admin exists, `/admin` is publicly reachable for onboarding. The **action** that creates the first admin must re-check availability on every POST (no admin + setup not completed) to limit races. Once complete, loaders must never show onboarding again (admin row check **and** persistent `Setting` key as in the original plan, so deleting the last admin does not silently re-expose setup unless you explicitly decide otherwise).

## Alternatives Considered

- **Separate `/admin/onboarding` URL:** Rejected — you want one canonical `/admin` entry.
- **Env setup token:** Strongest for empty production DBs; not required per product choice.
- **Localhost-only setup:** Safer locally; poor fit for hosted first deploy.
- **Public-until-created:** Operational simplicity; first visitor can claim the shop — mitigate with action-side double-check, not a separate URL.

## Files To Change

- `[app/routes.js](app/routes.js)`: Register `**index`** for `/admin` inside the **public** admin layout; **remove\*\* the authenticated-layout index that only redirects (so `/admin` resolves once, publicly).
- `[app/routes/admin/index.jsx](app/routes/admin/index.jsx)` (or a split module if cleaner): Public loader that branches authenticated → redirect, no admin → onboarding data, else → login; **action** only for onboarding POST (delegate login to existing `/admin/login` **or** accept POST on `/admin` for login if you collapse routes — prefer reusing `login.jsx` action via shared helper to avoid duplication).
- `[app/routes/admin/login.jsx](app/routes/admin/login.jsx)`: Optionally thin to a wrapper or redirect `**/admin/login` → `/admin`** for bookmarks and external links, **or\*\* keep both URLs sharing one form component (implementation choice: one URL is canonical per your spec).
- `[app/core/admin-onboarding/index.server.js](app/core/admin-onboarding/index.server.js)`: Availability, validation, first admin creation, setup flag.
- `[app/core/admin-onboarding/index.test.server.js](app/core/admin-onboarding/index.test.server.js)`: Tests for availability, validation, duplicates.
- **Auth layout / middleware:** Ensure `/admin` public index is excluded from “must be logged in” middleware while `/admin/dashboard` and siblings stay protected.

## Implementation Details

- Onboarding form fields: `name`, `email`, `password`, `confirmPassword`.
- Validation: normalized lowercase email, sensible email shape, password min length (e.g. 12), matching confirmation.
- Created user: `role: 'admin'`, `emailVerified: true`, credential account with `providerId: 'credential'`, `accountId: normalizedEmail`, bcrypt hash (same pattern as seeded admin).
- **Success:** Redirect to `**/admin?onboarded=1`** (or equivalent) so the **login\*\* UI appears on the same URL with a short success message — not to a separate onboarding path.
- **Failure / completed setup:** If someone hits `/admin` with no session but onboarding is unavailable, show **login** only; POST onboarding attempts return a clear error or redirect without creating users.
- **UI:** Reuse `AuthLayout`, `ErrorAlert`, `ButtonSubmit`, and the same visual language as `[app/routes/admin/login.jsx](app/routes/admin/login.jsx)` for both branches so onboarding and login feel like one admin surface.

## Validation

- Server tests for core workflow with mocked Prisma/bcrypt: no admin → can create; admin exists → cannot create; setup flag set → cannot create.
- Route/loader tests where practical: authenticated GET `/admin` → redirect dashboard; unauthenticated + zero admins → onboarding; unauthenticated + admins → login presentation (or redirect target).
- Commands: `npm run test -- --project server app/core/admin-onboarding/index.test.server.js` and `npm run lint` / format check as in repo conventions.

>
