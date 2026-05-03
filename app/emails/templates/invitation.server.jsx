import { Section, Text } from '@react-email/components';

import config from '#/config';
import EmailButton from '#/emails/components/button';
import EmailFooterLink from '#/emails/components/footer-link';
import EmailHeading from '#/emails/components/heading';
import EmailLayout from '#/emails/components/layout';
import EmailSubheading from '#/emails/components/subheading';

/**
 * Email template for organization invitation
 *
 * @param {Object} props - Component props
 * @param {string} props.organizationName - Name of the organization
 * @param {string} props.inviterName - Name of the person who sent the invite
 * @param {string} props.inviteUrl - URL to accept the invitation
 */
export default function InvitationTemplate({
  organizationName = 'the organization',
  inviterName = 'Someone',
  inviteUrl,
}) {
  return (
    <EmailLayout
      preview={`You've been invited to join ${organizationName} on ${config.appName}`}
    >
      <EmailHeading>You&apos;re Invited!</EmailHeading>
      <EmailSubheading>
        {inviterName} has invited you to join {organizationName} on{' '}
        {config.appName}.
      </EmailSubheading>
      <Section className="dark-mode-bg rounded-xl bg-indigo-50 px-6 py-2">
        <Text className="dark-mode-text mb-4 pb-4 text-base text-slate-700">
          Click the button below to accept the invitation and join the
          organization:
        </Text>
        <Section className="my-4 text-center">
          <EmailButton url={inviteUrl}>Accept Invitation</EmailButton>
        </Section>
        <Text className="dark-mode-text mb-4 py-4 text-base text-slate-700">
          This invitation will expire in 48 hours. If you don&apos;t accept
          within that time, you&apos;ll need to request a new invitation.
        </Text>
        <Text className="dark-mode-text text-base text-slate-700">
          If you weren&apos;t expecting this invitation, you can safely ignore
          this email.
        </Text>
      </Section>
      <EmailFooterLink url={inviteUrl} />
    </EmailLayout>
  );
}
