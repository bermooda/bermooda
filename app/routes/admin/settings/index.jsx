// Multi-section settings admin: General, SEO, Currencies, Locales, Tax, Shipping,
// Admin Users, Email Templates Preview.

import { useState } from 'react';
import { useLoaderData } from 'react-router';

import { authenticate } from '#/libs/auth/admin/index.server';
import { listProvidersWithDetails as listAddressValidationProviders } from '#/core/address-validation/index.server';
import { ADMIN_AVAILABLE_LOCALES, useT } from '#/core/i18n';
import { getRequestLocale } from '#/core/i18n/index.server';
import {
  listAdminUsers,
  requirePermission,
  SETTINGS_MANAGE_PERMISSION,
  updateAdminUserRole,
} from '#/core/rbac/index.server';
import { parseSeoSettingsFormData } from '#/core/seo/input';
import {
  getAdminSettingsSnapshot,
  saveGeneralSettings,
  saveCurrencySettings,
  saveLocaleSettings,
  saveSeoSettings,
  saveShippingSettings,
  saveTaxSettings,
  saveAddressValidationSettings,
  set,
} from '#/core/settings/index.server';
import { parseUploadFileInput, uploadMedia } from '#/core/storage/index.server';
import PageHeader from '#/components/admin/page-header';
import { AddressValidationTab } from '#/components/admin/settings/address-validation-tab';
import { AdminUsersTab } from '#/components/admin/settings/admin-users-tab';
import { CurrenciesTab } from '#/components/admin/settings/currencies-tab';
import { EmailTemplatesTab } from '#/components/admin/settings/email-templates-tab';
import { GeneralTab } from '#/components/admin/settings/general-tab';
import { LocalesTab } from '#/components/admin/settings/locales-tab';
import { SeoTab } from '#/components/admin/settings/seo-tab';
import { ShippingTab } from '#/components/admin/settings/shipping-tab';
import { TaxTab } from '#/components/admin/settings/tax-tab';
import Tabs from '#/components/admin/tabs';

/**
 * @param {{ request: Request }} args
 */
export async function loader({ request }) {
  const adminLocale = await getRequestLocale(request);

  const [settings, users, addressValidationProviders] = await Promise.all([
    getAdminSettingsSnapshot(),
    listAdminUsers(),
    Promise.resolve(listAddressValidationProviders()),
  ]);

  return {
    ...settings,
    adminLocale,
    adminAvailableLocales: ADMIN_AVAILABLE_LOCALES,
    users,
    addressValidationProviders,
  };
}

/**
 * @param {{ request: Request }} args
 */
export async function action({ request }) {
  const formData = await request.formData();
  const intent = formData.get('intent');

  if (intent === 'save-general') {
    await saveGeneralSettings({
      shopName: formData.get('shopName'),
      contactEmail: formData.get('contactEmail'),
    });
    return { ok: true, intent };
  }

  if (intent === 'save-seo') {
    await saveSeoSettings(parseSeoSettingsFormData(formData));
    return { ok: true, intent };
  }

  if (intent === 'upload-seo-image') {
    try {
      const file = parseUploadFileInput(formData.get('file'));
      const { url } = await uploadMedia(file);
      await set('seo.ogImageUrl', url);
      return { ok: true, intent, ogImageUrl: url };
    } catch (err) {
      return { ok: false, error: err.message, intent };
    }
  }

  if (intent === 'remove-seo-image') {
    await set('seo.ogImageUrl', '');
    return { ok: true, intent };
  }

  if (intent === 'save-currencies') {
    await saveCurrencySettings({
      currencies: formData.getAll('currencies').map(String),
      defaultCurrency: formData.get('defaultCurrency'),
    });
    return { ok: true, intent };
  }

  if (intent === 'save-locales') {
    await saveLocaleSettings({
      locales: formData.getAll('locales').map(String),
      defaultLocale: formData.get('defaultLocale'),
    });
    return { ok: true, intent };
  }

  if (intent === 'save-tax') {
    await saveTaxSettings({
      taxMode: formData.get('taxMode'),
      taxRegions: formData.get('taxRegions'),
    });
    return { ok: true, intent };
  }

  if (intent === 'save-shipping') {
    await saveShippingSettings({
      shippingZones: formData.get('shippingZones'),
    });
    return { ok: true, intent };
  }

  if (intent === 'save-address-validation') {
    await saveAddressValidationSettings({
      provider: formData.get('provider'),
    });
    return { ok: true, intent };
  }

  if (intent === 'change-role') {
    const session = await authenticate(request);
    try {
      await requirePermission(session.user, SETTINGS_MANAGE_PERMISSION);
      await updateAdminUserRole(
        formData.get('userId')?.toString(),
        formData.get('role')?.toString()
      );
      return { ok: true, intent };
    } catch (err) {
      if (err.code === 'FORBIDDEN') {
        return { ok: false, error: 'Forbidden', intent };
      }
      return { ok: false, error: err.message, intent };
    }
  }

  return { ok: false, error: 'Unknown intent.' };
}

/**
 * Admin settings route with tabbed configuration sections.
 *
 * @returns {React.ReactElement}
 */
export default function AdminSettingsRoute() {
  const t = useT();
  const data = useLoaderData();
  const [activeTab, setActiveTab] = useState(0);
  const tabs = [
    t('admin.settings.index.tab.general'),
    t('admin.settings.index.tab.seo'),
    t('admin.settings.index.tab.currencies'),
    t('admin.settings.index.tab.locales'),
    t('admin.settings.index.tab.tax'),
    t('admin.settings.index.tab.shipping'),
    t('admin.settings.index.tab.addressValidation'),
    t('admin.settings.index.tab.adminUsers'),
    t('admin.settings.index.tab.emailTemplates'),
  ];

  return (
    <div>
      <PageHeader
        title={t('admin.settings.index.title')}
        subtitle={t('admin.settings.index.subtitle')}
        className="mb-6"
      />

      <Tabs
        tabs={tabs}
        active={activeTab}
        onChange={setActiveTab}
        className="mb-6"
      />

      {activeTab === 0 && <GeneralTab data={data} />}
      {activeTab === 1 && <SeoTab data={data} />}
      {activeTab === 2 && <CurrenciesTab data={data} />}
      {activeTab === 3 && <LocalesTab data={data} />}
      {activeTab === 4 && <TaxTab data={data} />}
      {activeTab === 5 && <ShippingTab data={data} />}
      {activeTab === 6 && <AddressValidationTab data={data} />}
      {activeTab === 7 && <AdminUsersTab data={data} />}
      {activeTab === 8 && <EmailTemplatesTab />}
    </div>
  );
}
