import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('#/core/events/index.server', () => ({ on: vi.fn() }));
vi.mock('#/core/orders/index.server', () => ({
  registerPaymentEventHandlers: vi.fn(),
}));
vi.mock('#/core/payments/index.server', () => ({ registerProvider: vi.fn() }));
vi.mock('#/core/payments/stripe.server', () => ({
  stripeProvider: { name: 'Stripe' },
}));
vi.mock('#/core/shipping/index.server', () => ({
  registerProvider: vi.fn(),
  flatRateProvider: { name: 'Flat Rate' },
}));
vi.mock('#/core/tax/index.server', () => ({
  registerProvider: vi.fn(),
  simplePercentProvider: { name: 'Simple Percent' },
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
  let registerTheme;
  let registerPaymentEventHandlers;

  beforeEach(async () => {
    vi.resetModules();

    const bootstrap = await import('#/core/bootstrap.server');
    const payments = await import('#/core/payments/index.server');
    const shipping = await import('#/core/shipping/index.server');
    const tax = await import('#/core/tax/index.server');
    const themes = await import('#/core/themes/index.server');
    const orders = await import('#/core/orders/index.server');

    registerBuiltins = bootstrap.registerBuiltins;
    __resetBootstrap = bootstrap.__resetBootstrap;
    registerPayment = payments.registerProvider;
    registerShipping = shipping.registerProvider;
    registerTax = tax.registerProvider;
    registerTheme = themes.registerTheme;
    registerPaymentEventHandlers = orders.registerPaymentEventHandlers;
  });

  it('registers all built-in providers and event handlers on first call', () => {
    registerBuiltins();

    expect(registerPayment).toHaveBeenCalledWith('stripe', expect.any(Object));
    expect(registerShipping).toHaveBeenCalledWith(
      'flat_rate',
      expect.any(Object)
    );
    expect(registerTax).toHaveBeenCalledWith(
      'simple_percent',
      expect.any(Object)
    );
    expect(registerTheme).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'default' })
    );
    expect(registerPaymentEventHandlers).toHaveBeenCalledOnce();
  });

  it('is idempotent — second call is a no-op', () => {
    registerBuiltins();
    registerBuiltins();

    expect(registerPayment).toHaveBeenCalledOnce();
    expect(registerPaymentEventHandlers).toHaveBeenCalledOnce();
  });

  it('re-registers after __resetBootstrap', () => {
    registerBuiltins();
    __resetBootstrap();
    registerBuiltins();

    expect(registerPayment).toHaveBeenCalledTimes(2);
    expect(registerPaymentEventHandlers).toHaveBeenCalledTimes(2);
  });
});
