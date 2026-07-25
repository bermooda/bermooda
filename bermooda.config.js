const config = {
  appName: 'bermooda',
  // A short description of your app for SEO tags (can be changed per route)
  appDescription:
    'Open-source ecommerce platform: storefront and admin on React Router 7, Prisma, and Stripe.',
  // Public site URL. Required in production. Optional in development/test —
  // when omitted, `#/core/config` defaults to http://localhost:3000. When set,
  // this value overrides the auto-dev URL in every environment.
  // baseUrl: 'https://bermooda.fly.dev',
  auth: {
    adminCookiePrefix: 'bermooda_admin_',
    customerCookiePrefix: 'bermooda_customer_',
    adminBasePath: '/admin/auth',
    customerBasePath: '/account/auth',
    adminCallbackUrl: '/admin/dashboard',
    customerCallbackUrl: '/account',
  },
  stripe: {
    // Create multiple plans in your Stripe dashboard, then add them here. You can add as many plans as you want, just make sure to add the priceId
    plans: [
      {
        // REQUIRED — we use this to find the plan in the webhook (for instance if you want to update the user's credits based on the plan)
        priceId:
          process.env.NODE_ENV === 'development'
            ? 'price_1R7ZgIC2L7kHUqtLIIE0uwok'
            : 'price_1R7ZgIC2L7kHUqtLIIE0uwok',
        //  REQUIRED - Name of the plan, displayed on the pricing page
        name: 'Standard',
        // A friendly description of the plan, displayed on the pricing page. Tip: explain why this plan and not others
        description: 'Perfect for small projects',
        // The price you want to display, the one user will be charged on Stripe.
        price: 199,
        // If you have an anchor price (i.e. $29) that you want to display crossed out, put it here. Otherwise, leave it empty
        priceAnchor: 249,
        features: [
          'Storefront and merchant admin',
          'Catalog, cart, and orders',
          'Prisma database integration',
          'Email templates and sending',
          'Responsive Tailwind UI',
          'Stripe Checkout integration',
          '30 days of support',
        ],
      },
      {
        priceId:
          process.env.NODE_ENV === 'development'
            ? 'price_1R7Zh6C2L7kHUqtLQaBbTjBm'
            : 'price_1R7Zh6C2L7kHUqtLQaBbTjBm',
        // This plan will look different on the pricing page, it will be highlighted. You can only have one plan with isFeatured: true
        highlighted: true,
        name: 'Premium',
        description: 'You need more power',
        price: 249,
        priceAnchor: 299,
        features: [
          'Everything in Standard plan',
          'Advanced Stripe integration',
          '1 year of updates',
          'Premium support',
          'Custom branding options',
          'Performance optimization',
          '1-hour response time during business hours',
          'Priority bug fixes',
        ],
      },
    ],
  },
  resend: {
    // Email 'from' used when sending magic login links
    fromNoReply: `bermooda <noreply@mail.sturmfrei.com.au>`,
  },
};

export default config;
