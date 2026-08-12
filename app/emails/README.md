# Email Templates

This directory contains React Email templates and send helpers for the application.

Transport defaults to the **built-in Nodemailer (SMTP)** provider, configured via
`email.smtp` in `bermooda.config.js`. When `email.smtp` is omitted, Nodemailer
uses its defaults (`localhost:587`, no auth). You can optionally enable **one**
email provider plugin under **Admin → Plugins** (Resend, SendGrid, Amazon SES,
or a custom plugin) to replace Nodemailer as the active transport. Templates
render to HTML via `@react-email/render`, then call `#/libs/email`.

## Choosing a provider

1. **Default (Nodemailer):** set `email.fromNoReply` (and optionally `email.smtp`)
   in `bermooda.config.js`. No plugin required.
2. **ESP plugin:** open **Admin → Plugins → Email providers**, enter credentials
   in the plugin settings form (API keys are encrypted at rest), and click
   **Activate** on exactly one transport. Activating another deactivates the
   current one; disabling the plugin falls back to Nodemailer.

## Custom providers via plugins

```js
import { definePlugin, defineProvider } from '#/core/plugins/index.server';

export const pluginManifest = definePlugin({
  providers: {
    postmark: defineProvider('email', {
      name: 'Postmark',
      async send({ from, to, subject, html, text }) {
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

async function handleSignUp(userData) {
  await sendWelcomeEmail({
    email: userData.email,
    name: userData.name,
  });
}
```

## How to Create a New Email Template

1. Create a new React component in this directory
2. Export your component and add a sending function in `#/emails/index.server`
3. Use Tailwind CSS classes for styling
