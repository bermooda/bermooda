const config = {
  // Public site URL. Required in production. Optional in development/test —
  // when omitted, `#/libs/config` defaults to http://localhost:${PORT}
  // (PORT env, else 3000 — same value as Vite server.port). When set, this
  // value overrides the auto-dev URL in every environment.
  // baseUrl: 'https://shop.example.com',
  email: {
    // Email 'from' used when sending transactional and auth mail
    fromNoReply: 'bermooda <noreply@example.com>',

    // Built-in Nodemailer SMTP transport (default when no email plugin is
    // active). When omitted, Nodemailer uses its defaults: localhost:587,
    // no auth — suitable for Mailpit/MailHog/local postfix.
    // smtp: {
    //   host: 'smtp.example.com',
    //   port: 587,
    //   secure: false,
    //   auth: {
    //     user: 'user',
    //     pass: 'pass',
    //   },
    // },
    // Or a connection URL:
    // smtp: 'smtps://user:pass@smtp.example.com',
  },
};

export default config;
