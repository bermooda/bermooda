import { Section, Text } from '@react-email/components';

import config from '#bermooda.config';
import EmailButton from '#/emails/components/button';
import EmailFooterLink from '#/emails/components/footer-link';
import EmailHeading from '#/emails/components/heading';
import EmailLayout from '#/emails/components/layout';
import EmailSubheading from '#/emails/components/subheading';

/**
 * Email template for resetting password
 *
 * @param {Object} props - Component props
 * @param {string} props.name - Recipient's name
 * @param {string} props.resetUrl - URL for password reset
 */
export default function ResetPasswordTemplate({ name = 'there', resetUrl }) {
  return (
    <EmailLayout preview={`Reset your ${config.appName} password`}>
      <EmailHeading>Reset Your Password</EmailHeading>
      <EmailSubheading>
        Hi {name}, we received a request to reset your password.
      </EmailSubheading>
      <Section className="dark-mode-bg rounded-xl bg-indigo-50 px-6 py-2">
        <Text className="dark-mode-text mb-4 pb-4 text-base text-slate-700">
          You can reset your password by clicking the button below:
        </Text>
        <Section className="my-4 text-center">
          <EmailButton url={resetUrl}>Reset Password</EmailButton>
        </Section>
        <Text className="dark-mode-text mb-4 py-4 text-base text-slate-700">
          This link will expire in 1 hour. If you don&apos;t use it within that
          time, you&apos;ll need to request a new password reset link.
        </Text>
        <Text className="dark-mode-text text-base text-slate-700">
          If you didn&apos;t request a password reset, please ignore this email
          or contact support if you have concerns about your account.
        </Text>
      </Section>
      <EmailFooterLink url={resetUrl} />
    </EmailLayout>
  );
}
