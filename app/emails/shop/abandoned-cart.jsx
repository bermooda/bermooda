import { Column, Row, Section, Text } from '@react-email/components';

import config from '#/libs/config';
import { cartLineTotal } from '#/core/cart/lines';
import EmailButton from '#/emails/components/button';
import EmailFooterLink from '#/emails/components/footer-link';
import EmailHeading from '#/emails/components/heading';
import EmailLayout from '#/emails/components/layout';
import EmailSubheading from '#/emails/components/subheading';
import { emailT } from '#/emails/i18n.server';

function fmt(cents, currency) {
  return new Intl.NumberFormat('en', { style: 'currency', currency }).format(
    cents / 100
  );
}

/**
 * @param {Object} props
 * @param {string} [props.locale]
 * @param {string} [props.brandName]
 * @param {string} props.name
 * @param {string} [props.cartUrl]
 * @param {Array<{title: string, quantity: number, priceCentsSnapshot: number}>} [props.lines]
 * @param {string} [props.currency]
 */
export default function AbandonedCartEmail({
  locale = 'en',
  name = 'there',
  cartUrl,
  lines = [],
  currency = 'USD',
  brandName,
}) {
  const t = emailT(locale);
  const url = cartUrl ?? `${config.baseUrl}/cart`;

  return (
    <EmailLayout brandName={brandName} preview={t('abandonedCart.preview')}>
      <EmailHeading>{t('abandonedCart.heading')}</EmailHeading>
      <EmailSubheading>
        {t('abandonedCart.subheading', { name })}
      </EmailSubheading>
      <Section className="dark-mode-bg rounded-xl bg-indigo-50 px-6 py-4">
        <Text className="dark-mode-text mb-2 text-base text-slate-700">
          {t('abandonedCart.body')}
        </Text>

        {lines.length > 0 && (
          <>
            <Text className="dark-mode-text mb-1 text-sm font-semibold text-slate-600">
              {t('abandonedCart.items')}
            </Text>
            {lines.map((line, i) => (
              <Row key={i} className="border-b border-slate-200 py-1">
                <Column className="dark-mode-text flex-1 text-sm text-slate-700">
                  {line.title} × {line.quantity}
                </Column>
                <Column className="dark-mode-text text-right text-sm text-slate-700">
                  {fmt(cartLineTotal(line), currency)}
                </Column>
              </Row>
            ))}
          </>
        )}

        <Section className="mt-4 text-center">
          <EmailButton url={url}>{t('abandonedCart.cta')}</EmailButton>
        </Section>
      </Section>
      <EmailFooterLink url={url} />
    </EmailLayout>
  );
}
