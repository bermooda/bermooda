import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sideEffectImports = vi.hoisted(() => ({
  eventsJobLoaded: vi.fn(),
}));

vi.mock('#/core/events/index.server', () => ({ on: vi.fn() }));
vi.mock('#/libs/auth/customer/index.server', () => ({
  setOnCustomerRegistered: vi.fn(),
}));
vi.mock('#/core/orders/index.server', () => ({
  registerPaymentEventHandlers: vi.fn(),
}));
vi.mock('#/core/payments/index.server', () => ({ registerProvider: vi.fn() }));
vi.mock('#/core/address-validation/index.server', () => ({
  registerProvider: vi.fn(),
  noopProvider: { name: 'No-op' },
}));
vi.mock('#/core/payments/manual/index.server', () => ({
  manualProvider: { name: 'Manual' },
}));
vi.mock('#/core/payments/paypal/index.server', () => ({
  paypalProvider: { name: 'PayPal' },
}));
vi.mock('#/core/payments/stripe.server', () => ({
  stripeProvider: { name: 'Stripe' },
  stripeElementProvider: { name: 'Card on site' },
}));
vi.mock('#/core/payments/klarna.server', () => ({
  klarnaProvider: { name: 'Klarna' },
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
vi.mock('#/core/loyalty/index.server', () => ({
  registerLoyaltySubscribers: vi.fn(),
}));
vi.mock('#/core/plugins/index.server', () => ({
  discoverPlugins: vi.fn(),
  enablePersistedPlugins: vi.fn(),
}));
vi.mock('#/core/rbac/index.server', () => ({
  seedRolePermissions: vi.fn(),
}));
vi.mock('#/core/marketing/job.server', () => ({
  queueAbandonedCartSequence: vi.fn(),
}));
vi.mock('#/core/marketing/index.server', () => ({
  seedDefaultAbandonedCartSequences: vi.fn(),
}));
vi.mock('#/emails/index.server', () => ({
  sendCampaignEmail: vi.fn(),
}));
vi.mock('#/emails/job.server', () => ({
  queueAbandonedCart: vi.fn(),
}));
vi.mock('#/core/shipping/index.server', () => ({
  registerProvider: vi.fn(),
  flatRateProvider: { name: 'Flat Rate' },
}));
vi.mock('#/core/shipping/carrier/index.server', () => ({
  carrierProvider: { name: 'Carrier' },
}));
vi.mock('#/core/shipping/pickup/index.server', () => ({
  pickupProvider: { name: 'Store Pickup' },
}));
vi.mock('#/core/tax/index.server', () => ({
  registerProvider: vi.fn(),
  simplePercentProvider: { name: 'Simple Percent' },
  automaticTaxProvider: { name: 'Automatic Tax' },
}));
vi.mock('#/core/tax/taxjar.server', () => ({
  taxJarProvider: { name: 'TaxJar' },
}));
vi.mock('#/core/search/index.server', () => ({
  registerProvider: vi.fn(),
  dbProvider: { name: 'Database' },
}));
vi.mock('#/core/themes/index.server', () => ({ discoverThemes: vi.fn() }));
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
  let registerAddressValidation;
  let discoverThemes;
  let registerPaymentEventHandlers;
  let registerAuditSubscribers;
  let registerBackInStockSubscribers;
  let registerLoyaltySubscribers;
  let setOnCustomerRegistered;
  let savedEnv;

  beforeEach(async () => {
    savedEnv = {
      KLARNA_API_KEY: process.env.KLARNA_API_KEY,
      TAXJAR_API_KEY: process.env.TAXJAR_API_KEY,
      CARRIER_API_KEY: process.env.CARRIER_API_KEY,
    };
    delete process.env.KLARNA_API_KEY;
    delete process.env.TAXJAR_API_KEY;
    delete process.env.CARRIER_API_KEY;

    vi.resetModules();
    sideEffectImports.eventsJobLoaded.mockClear();
    vi.doMock('#/core/events/job.server', () => {
      sideEffectImports.eventsJobLoaded();
      return { queueEmit: vi.fn() };
    });

    const bootstrap = await import('#/core/bootstrap/index.server');
    const payments = await import('#/core/payments/index.server');
    const shipping = await import('#/core/shipping/index.server');
    const tax = await import('#/core/tax/index.server');
    const search = await import('#/core/search/index.server');
    const themes = await import('#/core/themes/index.server');
    const orders = await import('#/core/orders/index.server');
    const audit = await import('#/core/audit/index.server');
    const backInStock = await import('#/core/back-in-stock/index.server');
    const loyalty = await import('#/core/loyalty/index.server');

    registerBuiltins = bootstrap.registerBuiltins;
    __resetBootstrap = bootstrap.__resetBootstrap;
    registerPayment = payments.registerProvider;
    registerShipping = shipping.registerProvider;
    registerTax = tax.registerProvider;
    registerSearch = search.registerProvider;
    discoverThemes = themes.discoverThemes;
    registerPaymentEventHandlers = orders.registerPaymentEventHandlers;
    registerAuditSubscribers = audit.registerAuditSubscribers;
    registerBackInStockSubscribers = backInStock.registerBackInStockSubscribers;
    registerLoyaltySubscribers = loyalty.registerLoyaltySubscribers;

    const customerAuth = await import('#/libs/auth/customer/index.server');
    setOnCustomerRegistered = customerAuth.setOnCustomerRegistered;

    const addressValidation =
      await import('#/core/address-validation/index.server');
    registerAddressValidation = addressValidation.registerProvider;
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it('registers all built-in providers and event handlers on first call', () => {
    registerBuiltins();

    expect(registerPayment).toHaveBeenCalledWith('stripe', expect.any(Object));
    expect(registerPayment).toHaveBeenCalledWith(
      'stripe_element',
      expect.any(Object)
    );
    expect(registerPayment).toHaveBeenCalledWith('paypal', expect.any(Object));
    expect(registerPayment).toHaveBeenCalledWith('manual', expect.any(Object));
    expect(registerPayment).not.toHaveBeenCalledWith(
      'klarna',
      expect.any(Object)
    );
    expect(registerShipping).toHaveBeenCalledWith(
      'flat_rate',
      expect.any(Object)
    );
    expect(registerShipping).toHaveBeenCalledWith('pickup', expect.any(Object));
    expect(registerShipping).not.toHaveBeenCalledWith(
      'carrier',
      expect.any(Object)
    );
    expect(registerTax).toHaveBeenCalledWith(
      'simple_percent',
      expect.any(Object)
    );
    expect(registerTax).toHaveBeenCalledWith('automatic', expect.any(Object));
    expect(registerTax).not.toHaveBeenCalledWith('taxjar', expect.any(Object));
    expect(registerSearch).toHaveBeenCalledWith('db', expect.any(Object));
    expect(registerAddressValidation).toHaveBeenCalledWith(
      'noop',
      expect.any(Object)
    );
    expect(discoverThemes).toHaveBeenCalledOnce();
    expect(registerPaymentEventHandlers).toHaveBeenCalledOnce();
    expect(registerAuditSubscribers).toHaveBeenCalledOnce();
    expect(registerBackInStockSubscribers).toHaveBeenCalledOnce();
    expect(registerLoyaltySubscribers).toHaveBeenCalledOnce();
    expect(setOnCustomerRegistered).toHaveBeenCalledWith(expect.any(Function));
  });

  it('loads the domain event queue job during bootstrap module import', () => {
    expect(sideEffectImports.eventsJobLoaded).toHaveBeenCalledOnce();
  });

  it('registers stub providers when env keys are set', () => {
    process.env.KLARNA_API_KEY = 'test-klarna';
    process.env.TAXJAR_API_KEY = 'test-taxjar';
    process.env.CARRIER_API_KEY = 'test-carrier';

    registerBuiltins();

    expect(registerPayment).toHaveBeenCalledWith('klarna', expect.any(Object));
    expect(registerShipping).toHaveBeenCalledWith(
      'carrier',
      expect.any(Object)
    );
    expect(registerTax).toHaveBeenCalledWith('taxjar', expect.any(Object));
  });

  it('is idempotent — second call is a no-op', () => {
    registerBuiltins();
    registerBuiltins();

    expect(registerPayment).toHaveBeenCalledTimes(4);
    expect(registerPaymentEventHandlers).toHaveBeenCalledOnce();
  });

  it('re-registers after __resetBootstrap', () => {
    registerBuiltins();
    __resetBootstrap();
    registerBuiltins();

    expect(registerPayment).toHaveBeenCalledTimes(8);
    expect(registerPaymentEventHandlers).toHaveBeenCalledTimes(2);
  });
});
