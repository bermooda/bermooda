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
import { registerBackInStockSubscribers } from '#/core/back-in-stock/index.server';
import { seedDefaultChannel } from '#/core/channels/index.server';
import { on } from '#/core/events/index.server';
import { registerLoyaltySubscribers } from '#/core/loyalty/index.server';
import { seedDefaultAbandonedCartSequences } from '#/core/marketing/index.server';
import { registerPaymentEventHandlers } from '#/core/orders/index.server';
import { registerProvider as registerPayment } from '#/core/payments/index.server';
import { klarnaProvider } from '#/core/payments/klarna.server';
import { manualProvider } from '#/core/payments/manual.server';
import { paypalProvider } from '#/core/payments/paypal.server';
import { stripeElementProvider } from '#/core/payments/stripe-element.server';
import { stripeProvider } from '#/core/payments/stripe.server';
import {
  discoverPlugins,
  enablePersistedPlugins,
} from '#/core/plugins/index.server';
import { seedRolePermissions } from '#/core/rbac/index.server';
import { dbProvider as dbSearchProvider } from '#/core/search/index.server';
import { registerProvider as registerSearch } from '#/core/search/index.server';
import { carrierProvider } from '#/core/shipping/carrier.server';
import { registerProvider as registerShipping } from '#/core/shipping/index.server';
import { flatRateProvider } from '#/core/shipping/index.server';
import { pickupProvider } from '#/core/shipping/pickup.server';
import { registerProvider as registerTax } from '#/core/tax/index.server';
import {
  simplePercentProvider,
  automaticTaxProvider,
} from '#/core/tax/index.server';
import { taxJarProvider } from '#/core/tax/taxjar.server';
import { registerTheme } from '#/core/themes/index.server';
import { registerWebhookSubscribers } from '#/core/webhooks/index.server';
// W2: load webhook delivery worker (registers enqueuer) + subscriber registration
import '#/core/webhooks/job.server';
// W6: scheduled export worker
import '#/core/exports/job.server';
// W9: marketing automation worker
import '#/core/marketing/job.server';
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
  registerPayment('stripe_element', stripeElementProvider);
  registerPayment('paypal', paypalProvider);
  registerPayment('manual', manualProvider);
  if (process.env.KLARNA_API_KEY) {
    registerPayment('klarna', klarnaProvider);
  }

  // Address validation — built-in no-op; Google/Loqate via plugin
  registerAddressValidation('noop', noopProvider);

  // Shipping providers
  registerShipping('flat_rate', flatRateProvider);
  registerShipping('pickup', pickupProvider);
  if (process.env.CARRIER_API_KEY) {
    registerShipping('carrier', carrierProvider);
  }

  // Tax providers
  registerTax('simple_percent', simplePercentProvider);
  registerTax('automatic', automaticTaxProvider);
  if (process.env.TAXJAR_API_KEY) {
    registerTax('taxjar', taxJarProvider);
  }

  // Search providers — W1: built-in DB provider (SQLite LIKE; Postgres ilike via W8)
  registerSearch('db', dbSearchProvider);

  // Default storefront theme — runtime resolution via preloadStorefrontTheme()
  registerTheme(defaultThemeManifest);

  // Domain-event subscribers
  // W0-4: payment events → order status transitions
  // W0-5: payment.refunded → inventory restoration (see orders module)
  registerPaymentEventHandlers({ on });

  // W2: fan out domain events to outbound webhook subscriptions
  registerWebhookSubscribers({ on });

  // W6: audit log subscribes to domain events
  registerAuditSubscribers({ on });

  // W7: back-in-stock notifications on inventory restock
  registerBackInStockSubscribers({ on });

  // W9: loyalty points + referral rewards on order confirmation
  registerLoyaltySubscribers({ on });

  // W8: discover bundled plugins (async enable + RBAC seed deferred)
  discoverPlugins();

  logger.info('Bootstrap complete: built-in providers + theme registered');
}

/**
 * Async bootstrap tasks that require DB access. Safe to fire-and-forget at
 * process start — failures are logged but do not block request handling.
 */
export async function initializeAsync() {
  try {
    await seedRolePermissions();
    await enablePersistedPlugins();
    await seedDefaultChannel();
    await seedDefaultAbandonedCartSequences();
    logger.info('Async bootstrap complete: RBAC seeded, plugins enabled');
  } catch (err) {
    logger.error({ err }, 'Async bootstrap failed');
  }
}

// Exported for testing only.
export { _bootstrapped as _isBootstrapped };

/** Reset bootstrap state. Test use only — never call in production. */
export function __resetBootstrap() {
  _bootstrapped = false;
}
