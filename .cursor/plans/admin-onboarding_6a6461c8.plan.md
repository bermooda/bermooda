---
name: admin-onboarding
overview: Add a first-admin setup route that is available only while the shop has no admin, creates the initial admin securely, then permanently sends future visits back to admin login. The UI will reuse the existing admin/auth visual language while keeping the mutation server-side and guarded against duplicate setup.
todos:
  - id: core-workflow
    content: Create tested server workflow for onboarding availability, validation, and first-admin creation
    status: pending
  - id: route-ui
    content: Add `/admin/onboarding` route with public loader/action and admin-styled setup form
    status: pending
  - id: redirects
    content: Disable onboarding after setup and redirect to admin login with optional success message
    status: pending
  - id: validate
    content: Run focused server tests and lint/format checks
    status: pending
isProject: false
---

# Admin Onboarding Plan

## Approach

- Add `/admin/onboarding` under the existing public admin route layout in [`/Users/cvgellhorn/dev/bermooda/app/routes.js`](/Users/cvgellhorn/dev/bermooda/app/routes.js), because no admin session exists yet.
- Use a small server-only workflow in [`/Users/cvgellhorn/dev/bermooda/app/core/admin-onboarding/index.server.js`](/Users/cvgellhorn/dev/bermooda/app/core/admin-onboarding/index.server.js) rather than placing business logic in the route.
- Implement the selected security model: the page is public only while no admin exists. The loader redirects to `/admin/login` once setup is unavailable, and the action repeats the check inside the write path before creating anything.
- Add a persistent setup flag using the existing `Setting` model key, so successful onboarding disables the route even if that initial admin is later removed. Existing seeded/admin users also disable the loader through the `User.role === 'admin'` check.

## Alternatives Considered

- Env setup token: strongest protection for empty production databases, but you chose not to require it.
- Localhost-only setup: safer for local installs, but not suitable for first setup on hosted deployments.
- Public-until-created: simplest operationally; the residual risk is that whoever reaches an empty deployment first can claim it. The implementation will reduce race risk but cannot authenticate intent without a secret.

## Files To Change

- [`/Users/cvgellhorn/dev/bermooda/app/routes.js`](/Users/cvgellhorn/dev/bermooda/app/routes.js): register `route('onboarding', 'routes/admin/onboarding.jsx')` in the public admin layout.
- [`/Users/cvgellhorn/dev/bermooda/app/routes/admin/onboarding.jsx`](/Users/cvgellhorn/dev/bermooda/app/routes/admin/onboarding.jsx): new loader/action/component for the setup form.
- [`/Users/cvgellhorn/dev/bermooda/app/core/admin-onboarding/index.server.js`](/Users/cvgellhorn/dev/bermooda/app/core/admin-onboarding/index.server.js): count existing admins, validate input, create the first admin and credential account with bcrypt, and mark setup complete.
- [`/Users/cvgellhorn/dev/bermooda/app/core/admin-onboarding/index.test.server.js`](/Users/cvgellhorn/dev/bermooda/app/core/admin-onboarding/index.test.server.js): focused server tests for availability, validation, and duplicate prevention.
- Optionally [`/Users/cvgellhorn/dev/bermooda/app/routes/admin/login.jsx`](/Users/cvgellhorn/dev/bermooda/app/routes/admin/login.jsx): show a short success message when redirected from onboarding.

## Implementation Details

- The onboarding form will collect `name`, `email`, `password`, and `confirmPassword`.
- Validation will normalize email to lowercase, require a valid-looking email, require a password of at least 12 characters, and require matching confirmation.
- The created user will be `role: 'admin'` and `emailVerified: true` so the first owner can immediately sign in through the existing `/admin/login` flow.
- The credential account will follow the seeded-admin pattern with `providerId: 'credential'`, `accountId: normalizedEmail`, and a bcrypt hash.
- On success, redirect to `/admin/login?onboarded=1`; all later visits to `/admin/onboarding` redirect to `/admin/login`.
- The UI will use `AuthLayout`, `ErrorAlert`, and `ButtonSubmit`, plus the same dark mesh, indigo/accent focus states, labels, and spacing already used by the admin login/manage area.

## Validation

- Add unit/server tests for the core workflow with mocked Prisma and bcrypt.
- Add route-level tests or direct loader/action tests where practical: no admin renders, existing admin redirects, valid action creates and redirects, race/duplicate state redirects without creating.
- Run targeted tests: `npm run test -- --project server app/core/admin-onboarding/index.test.server.js` plus any route test added.
- Run `npm run lint` or `npm run fmt:check` for touched files, noting this repo may have pre-existing oxfmt warnings.
