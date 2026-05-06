/**
 * Default theme route-to-component mappings.
 * Each entry maps a route pattern to the theme component that renders it.
 */
export const routeComponents = {
  '/': 'HomePage',
  '/products/:slug': 'ProductPage',
  '/categories/:slug': 'CategoryPage',
  '/cart': 'CartPage',
  '/checkout/:step': 'CheckoutLayout',
  '/thank-you/:orderNumber': 'CheckoutThankYouPage',
  '/account': 'AccountDashboard',
  '/account/orders': 'AccountOrdersPage',
  '/account/orders/:id': 'AccountOrderDetailPage',
  '/account/addresses': 'AccountAddressesPage',
  '/account/profile': 'AccountProfilePage',
  '/account/login': 'LoginPage',
  '/account/register': 'RegisterPage',
  '/account/forgot-password': 'ForgotPasswordPage',
  '/account/reset-password': 'ResetPasswordPage',
};
