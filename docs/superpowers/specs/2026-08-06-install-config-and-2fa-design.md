# Install config + admin 2FA onboarding

**Date:** 2026-08-06  
**Status:** Approved for implementation  
**Repos:** bermooda (app), @bermooda/cli

## Problem

1. `bermooda start` fails without `baseUrl` in `bermooda.config.js` when `NODE_ENV=production`. Local CLI install does not create that file; the committed config is merchant-specific and should not ship in the repo.
2. Bootstrap creates admin users with `twoFactorEnabled=true` (schema default) while email may be unconfigured, so login OTP is a dead end.

## Decisions

- Remove committed `bermooda.config.js`; ship `bermooda.config.example.js`.
- CLI writes `bermooda.config.js` on `install` (baseUrl + fromNoReply) and `dev-setup` (fromNoReply only).
- Direct clones / Cloud Agent: copy example → config if missing during setup.
- Approach 1: schema default `twoFactorEnabled=false`; email-ready gate for auto-on new staff; Security UI + banner for manual enable.

## Config generation

### App

- Delete `bermooda.config.js` from git; add `bermooda.config.example.js` (commented `baseUrl`, placeholder `fromNoReply`).
- Gitignore `bermooda.config.js` (local/merchant file).
- `package.json` `"files"`: replace `bermooda.config.js` with `bermooda.config.example.js`.
- `npm run setup` and Cloud Agent install: if config missing, copy from example.
- Vite / `#bermooda.config` alias unchanged (expects file at root after copy/CLI write).

### CLI

- Helper `writeBermoodaConfig(shopRoot, { baseUrl?, fromNoReply })`.
- `bermooda install`: prompt Base URL + From email; flags `--base-url`, `--from-email`. `--yes`: local defaults `http://localhost:3000` + placeholder from; server without `--base-url` fails.
- `bermooda dev-setup`: prompt From email only; omit `baseUrl`. Flag `--from-email`.
- Always write config before bootstrap.

## 2FA defaults & email-ready

### Schema / seed

- `User.twoFactorEnabled` default `false` + migration.
- Seed/bootstrap admin always sets `twoFactorEnabled: false`.

### Email-ready (`isAdminEmailReady()`)

True when:

1. `config.email.fromNoReply` is non-empty, and
2. `getActiveProviderId()` is non-null (email plugin registered/active).

No live send probe.

### New staff

- `createAdminStaffUser`: `twoFactorEnabled: true` only when email-ready; else `false`.
- Existing users are never auto-flipped when email later becomes ready.

### Reminder

- Banner in authenticated admin layout when current user has `twoFactorEnabled === false`.
- CTA → `/admin/security`.

## Security UI

- Route `/admin/security`; user-menu link.
- Enable/disable via better-auth client (`twoFactor.enable` / `disable`) with password.
- Enable gated on email-ready; otherwise explain configure from-address + email provider.
- Admin `twoFactor({ skipVerificationOnEnable: true, otpOptions… })` so enable activates email OTP without TOTP QR (matches `/admin/verify-2fa`).

## Out of scope

- Customer 2FA.
- TOTP authenticator-app UX.
- Auto-enabling 2FA for existing users when email becomes ready.
