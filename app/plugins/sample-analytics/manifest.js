export default {
  id: 'sample-analytics',
  name: 'Sample Analytics',
  version: '1.0.0',
  description:
    'Captures order.created events and surfaces them in admin and storefront pages.',
  adminRoutes: '#/plugins/sample-analytics/admin/routes.server',
  storefrontRoutes: '#/plugins/sample-analytics/storefront/routes.server',
};
