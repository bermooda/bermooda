import { index, layout, prefix, route } from '@react-router/dev/routes';

/**
 * For more route config examples, see:
 * https://reactrouter.com/start/framework/routing
 *
 * @type {import('@react-router/dev/routes').RouteConfigEntry[]}
 */
export default [
  // ---------------------------------------------------------------------------
  // Storefront — all wrapped in the i18n/currency layout
  // ---------------------------------------------------------------------------

  layout('routes/storefront/_layout.jsx', [
    // Home
    index('routes/storefront/index.jsx'),

    // Product catalog
    route('products/:slug', 'routes/storefront/products/$slug.jsx'),
    route('categories/:slug', 'routes/storefront/categories/$slug.jsx'),
    route('collections/:handle', 'routes/storefront/collections/$handle.jsx'),

    // Search
    route('search', 'routes/storefront/search.jsx'),

    // Cart
    route('cart', 'routes/storefront/cart.jsx'),

    // Checkout — single-page flow
    route('checkout', 'routes/storefront/checkout/index.jsx'),
    route(
      'thank-you/:orderNumber',
      'routes/storefront/thank-you/$orderNumber.jsx'
    ),

    // Customer account — public auth pages (no authentication required)
    route('account/login', 'routes/storefront/account/login.jsx'),
    route('account/register', 'routes/storefront/account/register.jsx'),
    route(
      'account/forgot-password',
      'routes/storefront/account/forgot-password.jsx'
    ),
    route(
      'account/reset-password',
      'routes/storefront/account/reset-password.jsx'
    ),
    route('account/logout', 'routes/storefront/account/logout.jsx'),

    // Customer account — protected area (auth verified in inner layout loader)
    layout('routes/storefront/account/_layout.jsx', [
      route('account', 'routes/storefront/account/index.jsx'),
      route('account/orders', 'routes/storefront/account/orders.jsx'),
      route('account/orders/:id', 'routes/storefront/account/orders/$id.jsx'),
      route(
        'account/orders/:id/return',
        'routes/storefront/account/orders/$id/return.jsx'
      ),
      route('account/addresses', 'routes/storefront/account/addresses.jsx'),
      route('account/profile', 'routes/storefront/account/profile.jsx'),
      route('account/wishlist', 'routes/storefront/account/wishlist.jsx'),
      route('account/loyalty', 'routes/storefront/account/loyalty.jsx'),
    ]),

    // Plugin storefront dispatcher — static route, descriptor resolved at request time
    route('apps/:pluginId/*', 'routes/storefront/apps/$pluginId.jsx'),

    // CMS pages — catch-all slug route (after reserved prefixes)
    route(':slug', 'routes/storefront/pages/$slug.jsx'),
  ]),

  // Locale + currency cookie API endpoints (POST-redirect pattern)
  route('api/set-locale', 'routes/storefront/api/set-locale.jsx'),
  route('api/set-currency', 'routes/storefront/api/set-currency.jsx'),

  // ---------------------------------------------------------------------------
  // W2: Storefront public REST API (/api/v1/*) — no API key required for catalog
  // ---------------------------------------------------------------------------
  layout('routes/api/v1/_layout.jsx', [
    ...prefix('api/v1', [
      route('catalog', 'routes/api/v1/catalog.jsx'),
      route('catalog/:id', 'routes/api/v1/catalog/$id.jsx'),
      route(
        'products/:productId/reviews',
        'routes/api/v1/products/$productId/reviews.jsx'
      ),
      route('categories', 'routes/api/v1/categories.jsx'),
      route('search', 'routes/api/v1/search.jsx'),
      route('cart', 'routes/api/v1/cart.jsx'),
      route('cart/:token', 'routes/api/v1/cart/$token.jsx'),
      route('cart/:token/lines', 'routes/api/v1/cart/$token/lines.jsx'),
      route(
        'cart/:token/lines/:lineId',
        'routes/api/v1/cart/$token/lines/$lineId.jsx'
      ),
      route('checkout', 'routes/api/v1/checkout.jsx'),
      route('checkout/:id', 'routes/api/v1/checkout/$id.jsx'),
      route('checkout/:id/update', 'routes/api/v1/checkout/$id/update.jsx'),
    ]),
  ]),

  // ---------------------------------------------------------------------------
  // W2: Admin REST API (/api/admin/v1/*) — requires admin-scoped API key
  // ---------------------------------------------------------------------------
  layout('routes/api/admin/v1/_layout.jsx', [
    ...prefix('api/admin/v1', [
      route('products', 'routes/api/admin/v1/products.jsx'),
      route('products/:id', 'routes/api/admin/v1/products/$id.jsx'),
      route('orders', 'routes/api/admin/v1/orders.jsx'),
      route('orders/:id', 'routes/api/admin/v1/orders/$id.jsx'),
      route('orders/:id/refunds', 'routes/api/admin/v1/orders/$id/refunds.jsx'),
      route('orders/:id/returns', 'routes/api/admin/v1/orders/$id/returns.jsx'),
      route(
        'orders/:id/shipments',
        'routes/api/admin/v1/orders/$id/shipments.jsx'
      ),
      route(
        'orders/:id/documents/invoice',
        'routes/api/admin/v1/orders/$id/documents/invoice.jsx'
      ),
      route(
        'shipments/:id/documents/packing-slip',
        'routes/api/admin/v1/shipments/$id/documents/packing-slip.jsx'
      ),
      route(
        'returns/:id/:action',
        'routes/api/admin/v1/returns/$id/$action.jsx'
      ),
      route('customers', 'routes/api/admin/v1/customers.jsx'),
      route('customers/:id', 'routes/api/admin/v1/customers/$id.jsx'),
      route(
        'customers/:id/store-credit',
        'routes/api/admin/v1/customers/$id/store-credit.jsx'
      ),
      route(
        'inventory/locations',
        'routes/api/admin/v1/inventory/locations.jsx'
      ),
      route('gift-cards', 'routes/api/admin/v1/gift-cards.jsx'),
      route('loyalty', 'routes/api/admin/v1/loyalty.jsx'),
      route('settings', 'routes/api/admin/v1/settings.jsx'),
      route('admin-users', 'routes/api/admin/v1/admin-users.jsx'),
      route('admin-users/:id', 'routes/api/admin/v1/admin-users/$id.jsx'),
      route('audit-logs', 'routes/api/admin/v1/audit-logs.jsx'),
      route('audit-logs/:id', 'routes/api/admin/v1/audit-logs/$id.jsx'),
      route('wishlists', 'routes/api/admin/v1/wishlists.jsx'),
      route('pos', 'routes/api/admin/v1/pos.jsx'),
      route(
        'subscriptions/plans',
        'routes/api/admin/v1/subscriptions/plans.jsx'
      ),
      route('discounts', 'routes/api/admin/v1/discounts.jsx'),
      route('discounts/:id', 'routes/api/admin/v1/discounts/$id.jsx'),
      route('collections', 'routes/api/admin/v1/collections.jsx'),
      route('collections/:id', 'routes/api/admin/v1/collections/$id.jsx'),
      route('api-keys', 'routes/api/admin/v1/api-keys.jsx'),
      route('api-keys/:id', 'routes/api/admin/v1/api-keys/$id.jsx'),
      route(
        'webhook-subscriptions',
        'routes/api/admin/v1/webhook-subscriptions.jsx'
      ),
      route(
        'webhook-subscriptions/:id',
        'routes/api/admin/v1/webhook-subscriptions/$id.jsx'
      ),
    ]),
  ]),

  // ---------------------------------------------------------------------------
  // Better Auth API handlers
  // ---------------------------------------------------------------------------

  route('admin/auth/*', 'routes/auth/admin.jsx'),
  route('account/auth/*', 'routes/auth/customer.jsx'),

  // ---------------------------------------------------------------------------
  // Webhooks + infrastructure
  // ---------------------------------------------------------------------------

  route('webhooks/:provider', 'routes/webhooks/$provider.jsx'),

  // Admin panel
  ...prefix('admin', [
    // Public admin routes (no auth required)
    layout('routes/admin/public/_layout.jsx', [
      index('routes/admin/index.jsx'), // /admin → login or onboarding
      route('login', 'routes/admin/login.jsx'),
      route('forgot-password', 'routes/admin/forgot-password.jsx'),
      route('reset-password', 'routes/admin/reset-password.jsx'),
      route('verify-2fa', 'routes/admin/verify-2fa.jsx'),
      route('logout', 'routes/admin/logout.jsx'),
    ]),
    // Authenticated admin routes
    layout('routes/admin/_layout.jsx', [
      route('dashboard', 'routes/admin/dashboard.jsx'),
      route('reports', 'routes/admin/reports/index.jsx'),
      route('reports/schedules/new', 'routes/admin/reports/schedules/new.jsx'),
      route('reports/export', 'routes/admin/reports/export.jsx'),
      route('audit-log', 'routes/admin/audit-log.jsx'),
      // Products (P5-3)
      route('products', 'routes/admin/products/index.jsx'),
      route('products/new', 'routes/admin/products/new.jsx'),
      route('products/:id', 'routes/admin/products/$id.jsx'),
      route(
        'products/:id/merchandising',
        'routes/admin/products/$id/merchandising.jsx'
      ),
      // Categories (P5-4)
      route('collections', 'routes/admin/collections/index.jsx'),
      route('collections/new', 'routes/admin/collections/new.jsx'),
      route('collections/:id', 'routes/admin/collections/$id.jsx'),
      route('import', 'routes/admin/import/index.jsx'),
      route('categories', 'routes/admin/categories/index.jsx'),
      route('categories/new', 'routes/admin/categories/new.jsx'),
      // Content (W5)
      route('pages', 'routes/admin/pages/index.jsx'),
      route('pages/new', 'routes/admin/pages/new.jsx'),
      route('pages/:id', 'routes/admin/pages/$id.jsx'),
      route('menus', 'routes/admin/menus/index.jsx'),
      route('reviews', 'routes/admin/reviews/index.jsx'),
      // Orders (P5-5)
      route('orders', 'routes/admin/orders/index.jsx'),
      route('orders/:id', 'routes/admin/orders/$id.jsx'),
      route('orders/:id/documents', 'routes/admin/orders/$id/documents.jsx'),
      // Customers (P5-6)
      route('customers', 'routes/admin/customers/index.jsx'),
      route('customers/new', 'routes/admin/customers/new.jsx'),
      route('customers/:id', 'routes/admin/customers/$id.jsx'),
      // Discounts (P5-7)
      route('discounts', 'routes/admin/discounts/index.jsx'),
      route('discounts/new', 'routes/admin/discounts/new.jsx'),
      route('inventory', 'routes/admin/inventory/index.jsx'),
      route('inventory/new', 'routes/admin/inventory/new.jsx'),
      route('customer-groups', 'routes/admin/customer-groups/index.jsx'),
      route('customer-groups/new', 'routes/admin/customer-groups/new.jsx'),
      route('price-lists', 'routes/admin/price-lists/index.jsx'),
      route('price-lists/new', 'routes/admin/price-lists/new.jsx'),
      route('gift-cards', 'routes/admin/gift-cards/index.jsx'),
      route('gift-cards/new', 'routes/admin/gift-cards/new.jsx'),
      route('subscriptions', 'routes/admin/subscriptions/index.jsx'),
      route('pos', 'routes/admin/pos/index.jsx'),
      route('companies', 'routes/admin/companies/index.jsx'),
      route('quotes', 'routes/admin/quotes/index.jsx'),
      route('loyalty', 'routes/admin/loyalty/index.jsx'),
      route('marketing', 'routes/admin/marketing/index.jsx'),
      route(
        'marketing/segments/new',
        'routes/admin/marketing/segments/new.jsx'
      ),
      route(
        'marketing/campaigns/new',
        'routes/admin/marketing/campaigns/new.jsx'
      ),
      route(
        'marketing/sequences/new',
        'routes/admin/marketing/sequences/new.jsx'
      ),
      route('channels', 'routes/admin/channels/index.jsx'),
      route('channels/new', 'routes/admin/channels/new.jsx'),
      // Themes (P5-8)
      route('themes', 'routes/admin/themes/index.jsx'),
      // Plugins (P5-9)
      route('plugins', 'routes/admin/plugins/index.jsx'),
      route('plugins/:pluginId/*', 'routes/admin/plugins/$pluginId.jsx'),
      // API settings (W2)
      route('api-settings', 'routes/admin/api-settings.jsx'),
      route('api-settings/keys/new', 'routes/admin/api-settings/keys/new.jsx'),
      route(
        'api-settings/webhooks/new',
        'routes/admin/api-settings/webhooks/new.jsx'
      ),
      // Settings (P5-10)
      route('settings', 'routes/admin/settings/index.jsx'),
      route('settings/users/new', 'routes/admin/settings/users/new.jsx'),
    ]),
  ]),

  // Healthcheck for deployments
  route('health', 'routes/health.jsx'),

  // Sitemap + robots
  route('sitemap.xml', 'routes/sitemap.jsx'),
  route('robots.txt', 'routes/robots.jsx'),

  // 404 catch-all — must be last
  route('*', 'routes/404.jsx'),
];

/**
 * Routes that should be indexed by search engines (SEO)
 */
export const INDEXED_ROUTES = [
  'account/login',
  'account/register',
  'sitemap.xml',
  '',
];
