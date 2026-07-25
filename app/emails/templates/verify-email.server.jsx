import { Section, Text } from '@react-email/components';

import config from '#/core/config';
import EmailButton from '#/emails/components/button';
import EmailFooterLink from '#/emails/components/footer-link';
import EmailHeading from '#/emails/components/heading';
import EmailLayout from '#/emails/components/layout';
import EmailSubheading from '#/emails/components/subheading';

/**
 * Email template for verifying email address and welcoming new users
 *
 * @param {Object} props - Component props
 * @param {string} props.name - Recipient's name
 * @param {string} props.verificationUrl - URL for email verification
 */
export default function VerifyEmailTemplate({
  name = 'there',
  verificationUrl,
}) {
  return (
    <EmailLayout
      preview={`Welcome to ${config.appName}! Please verify your email`}
    >
      <EmailHeading>Welcome to {config.appName}</EmailHeading>
      <EmailSubheading>Thanks for signing up, {name}!</EmailSubheading>
      <Section className="dark-mode-bg rounded-xl bg-indigo-50 px-6 py-2">
        <Text className="dark-mode-text mb-4 pb-4 text-base text-slate-700">
          We&apos;re excited to have you on board! To get started, please verify
          your email address by clicking the button below:
        </Text>
        <Section className="my-4 text-center">
          <EmailButton url={verificationUrl}>Verify Email Address</EmailButton>
        </Section>
        <Text className="dark-mode-text mb-4 py-4 text-base text-slate-700">
          This link will expire in 24 hours. If you don&apos;t verify your email
          within that time, you&apos;ll need to request a new verification link.
        </Text>
        <Text className="dark-mode-text text-base text-slate-700">
          Here are a few things you can do after verifying your email:
        </Text>
        <ul className="dark-mode-text list-disc pl-6 text-base text-slate-700">
          <li className="mb-2">Complete your profile</li>
          <li className="mb-2">Explore the dashboard</li>
          <li className="mb-2">Start building</li>
        </ul>
      </Section>
      <EmailFooterLink url={verificationUrl} />
    </EmailLayout>
  );
}
