import { Section, Text } from '@react-email/components';

import config, { PLATFORM_NAME } from '#/core/config';
import EmailButton from '#/emails/components/button';
import EmailFooterLink from '#/emails/components/footer-link';
import EmailHeading from '#/emails/components/heading';
import EmailLayout from '#/emails/components/layout';
import EmailSubheading from '#/emails/components/subheading';

/**
 * @param {string} shopName
 */
function buildLabels(shopName) {
  return {
    en: {
      preview: (name) => `Welcome to ${shopName}, ${name}!`,
      heading: `Welcome to ${shopName}`,
      subheading: (name) => `Thanks for creating an account, ${name}!`,
      body: 'You can now browse our store, track your orders, and manage your addresses from your account.',
      cta: 'Go to My Account',
    },
    de: {
      preview: (name) => `Willkommen bei ${shopName}, ${name}!`,
      heading: `Willkommen bei ${shopName}`,
      subheading: (name) => `Danke für Ihre Registrierung, ${name}!`,
      body: 'Sie können jetzt unseren Shop durchsuchen, Ihre Bestellungen verfolgen und Ihre Adressen in Ihrem Konto verwalten.',
      cta: 'Zu meinem Konto',
    },
    fr: {
      preview: (name) => `Bienvenue sur ${shopName}, ${name}!`,
      heading: `Bienvenue sur ${shopName}`,
      subheading: (name) => `Merci de créer un compte, ${name}!`,
      body: 'Vous pouvez maintenant parcourir notre boutique, suivre vos commandes et gérer vos adresses depuis votre espace client.',
      cta: 'Accéder à mon compte',
    },
  };
}

/**
 * @param {Object} props
 * @param {string} [props.locale]
 * @param {string} props.name
 * @param {string} [props.accountUrl]
 * @param {string} [props.shopName]
 */
export default function CustomerWelcomeEmail({
  locale = 'en',
  name = 'there',
  accountUrl,
  shopName = PLATFORM_NAME,
}) {
  const labels = buildLabels(shopName);
  const t = labels[locale] ?? labels.en;
  const url = accountUrl ?? `${config.baseUrl}/account`;

  return (
    <EmailLayout preview={t.preview(name)} brandName={shopName}>
      <EmailHeading>{t.heading}</EmailHeading>
      <EmailSubheading>{t.subheading(name)}</EmailSubheading>
      <Section className="dark-mode-bg rounded-xl bg-indigo-50 px-6 py-4">
        <Text className="dark-mode-text text-base text-slate-700">
          {t.body}
        </Text>
        <Section className="my-4 text-center">
          <EmailButton url={url}>{t.cta}</EmailButton>
        </Section>
      </Section>
      <EmailFooterLink url={url} />
    </EmailLayout>
  );
}
