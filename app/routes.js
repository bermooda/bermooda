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

    // Cart
    route('cart', 'routes/storefront/cart.jsx'),

    // Checkout — 4-step flow (:step = address | shipping | payment | review)
    route('checkout/:step', 'routes/storefront/checkout/$step.jsx'),
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
      route('account/addresses', 'routes/storefront/account/addresses.jsx'),
      route('account/profile', 'routes/storefront/account/profile.jsx'),
    ]),

    // Plugin storefront dispatcher — static route, descriptor resolved at request time
    route('apps/:pluginId/*', 'routes/storefront/apps/$pluginId.jsx'),
  ]),

  // Locale + currency cookie API endpoints (POST-redirect pattern)
  route('api/set-locale', 'routes/storefront/api/set-locale.jsx'),
  route('api/set-currency', 'routes/storefront/api/set-currency.jsx'),

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
      route('login', 'routes/admin/login.jsx'),
      route('forgot-password', 'routes/admin/forgot-password.jsx'),
      route('reset-password', 'routes/admin/reset-password.jsx'),
      route('verify-2fa', 'routes/admin/verify-2fa.jsx'),
      route('logout', 'routes/admin/logout.jsx'),
    ]),
    // Authenticated admin routes
    layout('routes/admin/_layout.jsx', [
      index('routes/admin/index.jsx'), // /admin → redirect to /admin/dashboard
      route('dashboard', 'routes/admin/dashboard.jsx'),
      // Products (P5-3)
      route('products', 'routes/admin/products/index.jsx'),
      route('products/new', 'routes/admin/products/new.jsx'),
      route('products/:id', 'routes/admin/products/$id.jsx'),
      // Categories (P5-4)
      route('categories', 'routes/admin/categories/index.jsx'),
      // Orders (P5-5)
      route('orders', 'routes/admin/orders/index.jsx'),
      route('orders/:id', 'routes/admin/orders/$id.jsx'),
      // Customers (P5-6)
      route('customers', 'routes/admin/customers/index.jsx'),
      route('customers/:id', 'routes/admin/customers/$id.jsx'),
      // Discounts (P5-7)
      route('discounts', 'routes/admin/discounts/index.jsx'),
      // Themes (P5-8)
      route('themes', 'routes/admin/themes/index.jsx'),
      // Plugins (P5-9)
      route('plugins', 'routes/admin/plugins/index.jsx'),
      route('plugins/:pluginId/*', 'routes/admin/plugins/$pluginId.jsx'),
      // Settings (P5-10)
      route('settings', 'routes/admin/settings/index.jsx'),
    ]),
  ]),

  // Healthcheck for deployments
  route('health', 'routes/health.jsx'),

  // Sitemap
  route('sitemap.xml', 'routes/sitemap.jsx'),

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
  'products',
  'categories',
];
