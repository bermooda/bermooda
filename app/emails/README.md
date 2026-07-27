# Email Templates

This directory contains React Email templates and send helpers for the application.

Transport (Resend, SendGrid, Amazon SES, or a custom plugin provider) is handled by `#/libs/email`. Templates here render to HTML via `@react-email/render`, then call the active provider.

## Choosing a provider

1. Set credentials in the environment (`RESEND_API_KEY`, `SENDGRID_API_KEY`, or SES keys — see `.env.example`).
2. Pick the active provider in **Admin → Settings → Email**, or set `EMAIL_PROVIDER` / the `email.provider` setting (`resend` by default).

## Custom providers via plugins

Plugins can register an `email` provider. Once enabled, it appears in the admin provider list:

```js
import { definePlugin, defineProvider } from '#/core/plugins/index.server';

export const pluginManifest = definePlugin({
  providers: {
    postmark: defineProvider('email', {
      name: 'Postmark',
      async send({ from, to, subject, html, text }) {
        // Call your ESP with the pre-rendered HTML body.
        return { success: true };
      },
    }),
  },
});
```

## Available Templates

- **Welcome**: Sent to users after they sign up via google
- **Welcome / Verify Email**: Sent to users after they use the default signup
- Shop templates under `shop/` (order confirmation, shipping, refunds, etc.)

## How to Use

Import the individual functions from the `index` file in `emails`:

```js
import { sendWelcomeEmail } from '#/emails/index.server';

// In your sign-up handler
async function handleSignUp(userData) {
  // Sign up logic...

  // Send welcome email
  await sendWelcomeEmail({
    email: userData.email,
    name: userData.name,
  });
}
```

## How to Create a New Email Template

1. Create a new React component in this directory (see `welcome.jsx` for an example)
2. Export your component and add a sending function in `#/emails/index.server`
3. Use Tailwind CSS classes for styling

## Email Development Tips

- Always test your emails in various email clients
- Keep the design simple and accessible
- Use inline styles or Tailwind classes for maximum compatibility
- Avoid complex layouts that might break in email clients
