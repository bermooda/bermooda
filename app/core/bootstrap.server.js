// app/core/bootstrap.server.js
// Server startup bootstrap: registers all built-in providers, themes, and event
// subscribers exactly once per process. Call registerBuiltins() from
// app/entry.server.jsx at module load time (before any request is handled).
//
// Extension pattern for downstream workstreams:
//   - W1: import registerSearchProvider and call it here
//   - W3: import registerPaypalProvider etc. and call here
//   - W6: import registerAuditSubscribers and call here
// Never rewrite this file to add new calls; add them at the bottom of
// registerBuiltins() only if they must run before any request.

import logger from '#/utils/logger.server';

import { registerProvider as registerAddressValidation } from '#/core/address-validation/index.server';
import { noopProvider } from '#/core/address-validation/index.server';
import { registerAuditSubscribers } from '#/core/audit/index.server';
import { on } from '#/core/events/index.server';
import { registerPaymentEventHandlers } from '#/core/orders/index.server';
import { registerProvider as registerPayment } from '#/core/payments/index.server';
import { manualProvider } from '#/core/payments/manual.server';
import { paypalProvider } from '#/core/payments/paypal.server';
import { stripeProvider } from '#/core/payments/stripe.server';
import { dbProvider as dbSearchProvider } from '#/core/search/index.server';
import { registerProvider as registerSearch } from '#/core/search/index.server';
import { registerProvider as registerShipping } from '#/core/shipping/index.server';
import { flatRateProvider } from '#/core/shipping/index.server';
import { registerProvider as registerTax } from '#/core/tax/index.server';
import {
  simplePercentProvider,
  automaticTaxProvider,
} from '#/core/tax/index.server';
import { registerTheme } from '#/core/themes/index.server';
import { registerWebhookSubscribers } from '#/core/webhooks/index.server';
// W2: load webhook delivery worker (registers enqueuer) + subscriber registration
import '#/core/webhooks/job.server';
// W6: scheduled export worker
import '#/core/exports/job.server';
import defaultThemeManifest from '#/themes/default/manifest';

let _bootstrapped = false;

/**
 * Register all built-in providers, the default theme, and domain event
 * subscribers. Idempotent — safe to call multiple times (subsequent calls
 * are no-ops).
 */
export function registerBuiltins() {
  if (_bootstrapped) return;
  _bootstrapped = true;

  // Payment providers
  registerPayment('stripe', stripeProvider);
  registerPayment('paypal', paypalProvider);
  registerPayment('manual', manualProvider);

  // Address validation — built-in no-op; Google/Loqate via plugin
  registerAddressValidation('noop', noopProvider);

  // Shipping providers
  registerShipping('flat_rate', flatRateProvider);

  // Tax providers
  registerTax('simple_percent', simplePercentProvider);
  registerTax('automatic', automaticTaxProvider);

  // Search providers — W1: built-in DB provider (SQLite LIKE; Postgres ilike via W8)
  registerSearch('db', dbSearchProvider);

  // Default storefront theme
  // W0-6 decision: themes are import-based. Routes import directly from
  // #/themes/default/... so the admin theme-switcher does not hot-swap the
  // active theme at runtime. The registry is still populated so the admin
  // UI can list available themes. Full runtime theme resolution (option a)
  // is deferred to a later phase.
  registerTheme(defaultThemeManifest);

  // Domain-event subscribers
  // W0-4: payment events → order status transitions
  // W0-5: payment.refunded → inventory restoration (see orders module)
  registerPaymentEventHandlers({ on });

  // W2: fan out domain events to outbound webhook subscriptions
  registerWebhookSubscribers({ on });

  // W6: audit log subscribes to domain events
  registerAuditSubscribers({ on });

  logger.info('Bootstrap complete: built-in providers + theme registered');
}

// Exported for testing only.
export { _bootstrapped as _isBootstrapped };

/** Reset bootstrap state. Test use only — never call in production. */
export function __resetBootstrap() {
  _bootstrapped = false;
}
