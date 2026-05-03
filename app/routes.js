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

  // All authenticated app routes
  layout('routes/app/_layout.jsx', [
    route('dashboard', 'routes/app/dashboard.jsx'),
    route('organization', 'routes/app/organization.jsx'),
    route('settings', 'routes/app/settings.jsx'),
    route('support', 'routes/app/support.jsx'),
  ]),

  // Organization invitation acceptance
  route(
    'organization/accept-invitation',
    'routes/organization/accept-invitation.jsx'
  ),

  // Checkout
  route('checkout/polar', 'routes/checkout/polar.jsx'),
  route('checkout/successful', 'routes/checkout/successful.jsx'),

  // Webhooks
  route('webhooks/stripe', 'routes/webhooks/stripe.jsx'),
  route('webhooks/polar', 'routes/webhooks/polar.jsx'),

  // Healthcheck for deployments
  route('health', 'routes/health.jsx'),

  // Sitemap
  route('sitemap.xml', 'routes/sitemap.jsx'),

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
