import { Section, Text } from '@react-email/components';

import config from '#bermooda.config';
import EmailButton from '#/emails/components/button';
import EmailFooterLink from '#/emails/components/footer-link';
import EmailHeading from '#/emails/components/heading';
import EmailLayout from '#/emails/components/layout';

/**
 * @param {{ variant?: { sku?: string|null } }} props
 */
export default function BackInStockEmail({ variant }) {
  const sku = variant?.sku ?? 'this item';
  const shopUrl = `${config.baseUrl}/search?q=${encodeURIComponent(sku)}`;

  return (
    <EmailLayout preview={`${sku} is back in stock`}>
      <EmailHeading>Back in stock</EmailHeading>
      <Section className="dark-mode-bg rounded-xl bg-indigo-50 px-6 py-4">
        <Text className="dark-mode-text text-base text-slate-700">
          Good news — {sku} is available again.
        </Text>
        <Section className="mt-4 text-center">
          <EmailButton url={shopUrl}>Shop now</EmailButton>
        </Section>
      </Section>
      <EmailFooterLink url={shopUrl} />
    </EmailLayout>
  );
}
