import { useT } from '#/core/i18n';
import { SectionCard } from '#/components/admin/settings/shared';

const EMAIL_TEMPLATE_KEYS = [
  {
    key: 'order-confirmation',
    nameKey: 'admin.settings.emailTemplates.orderConfirmation.name',
    descriptionKey:
      'admin.settings.emailTemplates.orderConfirmation.description',
  },
  {
    key: 'password-reset-admin',
    nameKey: 'admin.settings.emailTemplates.passwordResetAdmin.name',
    descriptionKey:
      'admin.settings.emailTemplates.passwordResetAdmin.description',
  },
  {
    key: 'staff-invite',
    nameKey: 'admin.settings.emailTemplates.staffInvite.name',
    descriptionKey: 'admin.settings.emailTemplates.staffInvite.description',
  },
  {
    key: 'password-reset-customer',
    nameKey: 'admin.settings.emailTemplates.passwordResetCustomer.name',
    descriptionKey:
      'admin.settings.emailTemplates.passwordResetCustomer.description',
  },
  {
    key: 'customer-welcome',
    nameKey: 'admin.settings.emailTemplates.customerWelcome.name',
    descriptionKey: 'admin.settings.emailTemplates.customerWelcome.description',
  },
  {
    key: 'abandoned-cart',
    nameKey: 'admin.settings.emailTemplates.abandonedCart.name',
    descriptionKey: 'admin.settings.emailTemplates.abandonedCart.description',
  },
];

/**
 * Email templates preview tab.
 *
 * @returns {React.ReactElement}
 */
export function EmailTemplatesTab() {
  const t = useT();

  return (
    <SectionCard title={t('admin.settings.emailTemplates.title')}>
      <p className="text-text-muted mb-4 text-sm">
        {t('admin.settings.emailTemplates.introBefore')}{' '}
        <a href="/admin/plugins" className="text-accent underline">
          {t('admin.settings.emailTemplates.pluginsLink')}
        </a>
        {t('admin.settings.emailTemplates.introAfter')}
      </p>
      <div className="space-y-3">
        {EMAIL_TEMPLATE_KEYS.map((tpl) => (
          <div
            key={tpl.key}
            className="border-border flex items-start justify-between rounded-lg border px-4 py-3"
          >
            <div>
              <p className="text-text text-sm font-medium">{t(tpl.nameKey)}</p>
              <p className="text-text-muted mt-0.5 text-xs">
                {t(tpl.descriptionKey)}
              </p>
            </div>
            <span
              className="text-text-muted ml-4 shrink-0 text-xs italic"
              title={t('admin.settings.emailTemplates.previewTitle')}
            >
              {t('admin.settings.emailTemplates.previewSoon')}
            </span>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
