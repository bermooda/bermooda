import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('#/core/events/index.server', () => ({ on: vi.fn() }));
vi.mock('#/core/orders/index.server', () => ({
  registerPaymentEventHandlers: vi.fn(),
}));
vi.mock('#/core/payments/index.server', () => ({ registerProvider: vi.fn() }));
vi.mock('#/core/address-validation/index.server', () => ({
  registerProvider: vi.fn(),
  noopProvider: { name: 'No-op' },
}));
vi.mock('#/core/payments/manual.server', () => ({
  manualProvider: { name: 'Manual' },
}));
vi.mock('#/core/payments/paypal.server', () => ({
  paypalProvider: { name: 'PayPal' },
}));
vi.mock('#/core/payments/stripe.server', () => ({
  stripeProvider: { name: 'Stripe' },
}));
vi.mock('#/core/webhooks/index.server', () => ({
  registerWebhookSubscribers: vi.fn(),
}));
vi.mock('#/core/audit/index.server', () => ({
  registerAuditSubscribers: vi.fn(),
}));
vi.mock('#/core/back-in-stock/index.server', () => ({
  registerBackInStockSubscribers: vi.fn(),
}));
vi.mock('#/core/webhooks/job.server', () => ({}));
vi.mock('#/core/exports/job.server', () => ({}));
vi.mock('#/core/shipping/index.server', () => ({
  registerProvider: vi.fn(),
  flatRateProvider: { name: 'Flat Rate' },
}));
vi.mock('#/core/tax/index.server', () => ({
  registerProvider: vi.fn(),
  simplePercentProvider: { name: 'Simple Percent' },
  automaticTaxProvider: { name: 'Automatic Tax' },
}));
vi.mock('#/core/search/index.server', () => ({
  registerProvider: vi.fn(),
  dbProvider: { name: 'Database' },
}));
vi.mock('#/core/themes/index.server', () => ({ registerTheme: vi.fn() }));
vi.mock('#/themes/default/manifest', () => ({ default: { id: 'default' } }));
vi.mock('#/utils/logger.server', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe('bootstrap.server', () => {
  let registerBuiltins;
  let __resetBootstrap;
  let registerPayment;
  let registerShipping;
  let registerTax;
  let registerSearch;
  let registerTheme;
  let registerPaymentEventHandlers;
  let registerAuditSubscribers;
  let registerBackInStockSubscribers;

  beforeEach(async () => {
    vi.resetModules();

    const bootstrap = await import('#/core/bootstrap.server');
    const payments = await import('#/core/payments/index.server');
    const shipping = await import('#/core/shipping/index.server');
    const tax = await import('#/core/tax/index.server');
    const search = await import('#/core/search/index.server');
    const themes = await import('#/core/themes/index.server');
    const orders = await import('#/core/orders/index.server');
    const audit = await import('#/core/audit/index.server');
    const backInStock = await import('#/core/back-in-stock/index.server');

    registerBuiltins = bootstrap.registerBuiltins;
    __resetBootstrap = bootstrap.__resetBootstrap;
    registerPayment = payments.registerProvider;
    registerShipping = shipping.registerProvider;
    registerTax = tax.registerProvider;
    registerSearch = search.registerProvider;
    registerTheme = themes.registerTheme;
    registerPaymentEventHandlers = orders.registerPaymentEventHandlers;
    registerAuditSubscribers = audit.registerAuditSubscribers;
    registerBackInStockSubscribers = backInStock.registerBackInStockSubscribers;
  });

  it('registers all built-in providers and event handlers on first call', () => {
    registerBuiltins();

    expect(registerPayment).toHaveBeenCalledWith('stripe', expect.any(Object));
    expect(registerPayment).toHaveBeenCalledWith('paypal', expect.any(Object));
    expect(registerPayment).toHaveBeenCalledWith('manual', expect.any(Object));
    expect(registerShipping).toHaveBeenCalledWith(
      'flat_rate',
      expect.any(Object)
    );
    expect(registerTax).toHaveBeenCalledWith(
      'simple_percent',
      expect.any(Object)
    );
    expect(registerTax).toHaveBeenCalledWith('automatic', expect.any(Object));
    expect(registerSearch).toHaveBeenCalledWith('db', expect.any(Object));
    expect(registerTheme).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'default' })
    );
    expect(registerPaymentEventHandlers).toHaveBeenCalledOnce();
    expect(registerAuditSubscribers).toHaveBeenCalledOnce();
    expect(registerBackInStockSubscribers).toHaveBeenCalledOnce();
  });

  it('is idempotent — second call is a no-op', () => {
    registerBuiltins();
    registerBuiltins();

    expect(registerPayment).toHaveBeenCalledTimes(3);
    expect(registerPaymentEventHandlers).toHaveBeenCalledOnce();
  });

  it('re-registers after __resetBootstrap', () => {
    registerBuiltins();
    __resetBootstrap();
    registerBuiltins();

    expect(registerPayment).toHaveBeenCalledTimes(6);
    expect(registerPaymentEventHandlers).toHaveBeenCalledTimes(2);
  });
});
