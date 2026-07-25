import { Section, Text } from '@react-email/components';

import config from '#/core/config';
import EmailButton from '#/emails/components/button';
import EmailFooterLink from '#/emails/components/footer-link';
import EmailHeading from '#/emails/components/heading';
import EmailLayout from '#/emails/components/layout';

/**
 * @param {Object} props
 * @param {string} [props.brandName]
 * @param {{ sku?: string|null }} [props.variant]
 */
export default function BackInStockEmail({ brandName, variant }) {
  const sku = variant?.sku ?? 'this item';
  const shopUrl = `${config.baseUrl}/search?q=${encodeURIComponent(sku)}`;

  return (
    <EmailLayout brandName={brandName} preview={`${sku} is back in stock`}>
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
