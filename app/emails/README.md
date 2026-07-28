# Email Templates

This directory contains React Email templates and send helpers for the application.

Transport is pluggable: enable **one** email provider plugin under **Admin → Plugins** (Resend, SendGrid, Amazon SES, or a custom plugin). Templates render to HTML via `@react-email/render`, then call `#/libs/email`.

## Choosing a provider

1. Set credentials in the environment (`RESEND_API_KEY`, `SENDGRID_API_KEY`, or SES keys — see `.env.example`).
2. Open **Admin → Plugins → Email providers** and click **Activate** on exactly one transport. Activating another deactivates the current one.

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
