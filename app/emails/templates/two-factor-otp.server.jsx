import { Section, Text } from '@react-email/components';

import { PLATFORM_NAME } from '#/core/config';
import EmailHeading from '#/emails/components/heading';
import EmailLayout from '#/emails/components/layout';
import EmailSubheading from '#/emails/components/subheading';

/**
 * Email template for sending two-factor authentication OTP code
 *
 * @param {Object} props - Component props
 * @param {string} props.name - Recipient's name
 * @param {string} props.otp - The 6-digit OTP code
 */
export default function TwoFactorOtpTemplate({ name = 'there', otp }) {
  return (
    <EmailLayout preview={`Your ${PLATFORM_NAME} verification code: ${otp}`}>
      <EmailHeading>Two-Factor Authentication</EmailHeading>
      <EmailSubheading>Hi {name},</EmailSubheading>
      <Section className="dark-mode-bg rounded-xl bg-indigo-50 px-6 py-2">
        <Text className="dark-mode-text mb-4 pb-4 text-base text-slate-700">
          You&apos;ve requested to sign in to your {PLATFORM_NAME} account.
          Please use the verification code below to complete your login:
        </Text>
        <Section className="text-center">
          <Text className="dark-mode dark-text-cyan-400 m-0 rounded-lg bg-white px-4 py-6 font-mono text-4xl font-bold tracking-widest text-cyan-600">
            {otp}
          </Text>
        </Section>
        <Text className="dark-mode-text mb-4 py-4 text-base text-slate-700">
          This code will expire in 5 minutes. If you didn&apos;t request this
          code, please ignore this email.
        </Text>
        <Section className="dark-mode-bg my-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <Text className="dark-mode-text m-0 text-sm font-semibold text-amber-800">
            🔒 Security reminder:
          </Text>
          <Text className="dark-mode-text m-0 mt-2 text-sm text-amber-700">
            Never share this code with anyone. {PLATFORM_NAME} will never ask
            you for this code via phone or email.
          </Text>
        </Section>
      </Section>
    </EmailLayout>
  );
}
