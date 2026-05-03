# Email Templates

This directory contains react based email templates for the application.

## Available Templates

- **Welcome**: Sent to users after they sign up via google
- **Welcome / Verify Email**: Sent to users after they use the default signup

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
