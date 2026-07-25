import { Section, Text } from '@react-email/components';

import config from '#/core/config';
import EmailButton from '#/emails/components/button';
import EmailFooterLink from '#/emails/components/footer-link';
import EmailHeading from '#/emails/components/heading';
import EmailLayout from '#/emails/components/layout';
import EmailSubheading from '#/emails/components/subheading';

/**
 * Welcome email component
 *
 * @param {Object} props - Component props
 * @param {string} props.name - Recipient's name
 * @param {string} props.getStartedUrl - URL for getting started
 */
export default function WelcomeEmail({ name = 'there', getStartedUrl }) {
  return (
    <EmailLayout preview={`Thanks for signing up, ${name}!`}>
      <EmailHeading>Welcome to {config.appName}</EmailHeading>
      <EmailSubheading>Thanks for signing up, {name}!</EmailSubheading>
      <Section className="dark-mode-bg rounded-xl bg-indigo-50 px-6 py-2">
        <Text className="dark-mode-text text-base text-slate-700">
          We&apos;re excited to have you on board. Here are a few things you can
          do to get started:
        </Text>
        <ul className="dark-mode-text list-disc pl-6 text-base text-slate-700">
          <li className="mb-2">Complete your profile</li>
          <li className="mb-2">Explore the dashboard</li>
          <li className="mb-2">Start building</li>
        </ul>
      </Section>
      <Section className="my-4 text-center">
        <EmailButton url={getStartedUrl}>Get Started</EmailButton>
      </Section>
      <EmailFooterLink url={getStartedUrl} />
    </EmailLayout>
  );
}
