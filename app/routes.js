import { index, layout, prefix, route } from '@react-router/dev/routes';

/**
 * For more route config examples, see:
 * https://reactrouter.com/start/framework/routing
 *
 * @type {import('@react-router/dev/routes').RouteConfigEntry[]}
 */
export default [
  // Landing page
  index('routes/index.jsx'),

  // Login/out
  route('login', 'routes/login.jsx'),
  route('logout', 'routes/logout.jsx'),
  route('verify-2fa', 'routes/verify-2fa.jsx'),
  route('forgot-password', 'routes/password/forgot.jsx'),
  route('reset-password', 'routes/password/reset.jsx'),

  // Sign up
  ...prefix('signup', [
    index('routes/signup/index.jsx'),
    route('verify-email', 'routes/signup/verify-email.jsx'),
  ]),

  // Better Auth API routes
  route('auth/*', 'routes/auth/all.jsx'),
  route('admin/auth/*', 'routes/auth/admin.jsx'),
  route('account/auth/*', 'routes/auth/customer.jsx'),

  // Checkout
  route('checkout/successful', 'routes/checkout/successful.jsx'),

  // Webhooks
  route('webhooks/:provider', 'routes/webhooks/$provider.jsx'),

  // Plugin storefront dispatcher — static route, descriptor resolved at request time
  route('apps/:pluginId/*', 'routes/storefront/apps.$pluginId.jsx'),

  // Healthcheck for deployments
  route('health', 'routes/health.jsx'),

  // Sitemap
  route('sitemap.xml', 'routes/sitemap.jsx'),

  // Admin panel
  ...prefix('admin', [
    // Public admin routes (no auth required)
    layout('routes/admin/_public.jsx', [
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

  // 404 catch all route - must be the last route
  route('*', 'routes/404.jsx'),
];

/**
 * Routes that should be indexed by search engines (SEO)
 * The root landing page is indexed by default
 */
export const INDEXED_ROUTES = [
  'login',
  'signup',
  'forgot-password',
  'sitemap.xml',
];
