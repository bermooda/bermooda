const config = {
  // Public site URL. Required in production. Optional in development/test —
  // when omitted, `#/libs/config` defaults to http://localhost:${PORT}
  // (PORT env, else 3000 — same value as Vite server.port). When set, this
  // value overrides the auto-dev URL in every environment.
  // baseUrl: 'https://bermooda.fly.dev',
  email: {
    // Email 'from' used when sending transactional and auth mail
    fromNoReply: `bermooda <noreply@mail.sturmfrei.com.au>`,
  },
};

export default config;
