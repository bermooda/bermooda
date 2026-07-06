// Multi-section settings admin: General, SEO, Currencies, Locales, Tax, Shipping,
// Admin Users, Email Templates Preview.

import {
  CheckIcon,
  PhotoIcon,
  PlusIcon,
  TrashIcon,
  UserPlusIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';
import {
  Link,
  useFetcher,
  useLoaderData,
  useLocation,
  useRevalidator,
} from 'react-router';

import { authenticate } from '#/libs/auth/admin.server';
import prisma from '#/libs/prisma.server';
import {
  ADMIN_AVAILABLE_LOCALES,
  LOCALE_LABELS,
  LOCALE_OPTIONS,
} from '#/core/i18n/index';
import { getRequestLocale } from '#/core/i18n/index.server';
import { hasPermission } from '#/core/rbac/index.server';
import { parseSeoSettingsInput } from '#/core/seo/input';
import { AVAILABLE_CURRENCIES } from '#/core/settings/defaults';
import {
  getAdminSettingsSnapshot,
  saveGeneralSettings,
  saveCurrencySettings,
  saveLocaleSettings,
  saveSeoSettings,
  saveShippingSettings,
  saveTaxSettings,
  set,
} from '#/core/settings/index.server';
import { uploadMedia } from '#/core/storage/index.server';
import Badge from '#/components/admin/badge';
import Card from '#/components/admin/card';
import { controlClasses } from '#/components/admin/form/input';
import PageHeader from '#/components/admin/page-header';
import Table, { TBody, Td, Th, THead } from '#/components/admin/table';
import Tabs from '#/components/admin/tabs';
import Button from '#/components/ui/button';

const CHECKBOX_CLASS =
  'border-border text-accent focus:ring-accent bg-surface h-4 w-4 rounded';
const RADIO_CLASS = 'border-border text-accent focus:ring-accent h-4 w-4';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TABS = [
  'General',
  'SEO',
  'Currencies',
  'Locales',
  'Tax',
  'Shipping',
  'Admin Users',
  'Email Templates',
];

const EMAIL_TEMPLATES = [
  {
    key: 'order-confirmation',
    name: 'Order Confirmation',
    description: 'Sent to customers after a successful order is placed.',
  },
  {
    key: 'password-reset-admin',
    name: 'Password Reset (Admin)',
    description: 'Sent to admin users when they request a password reset.',
  },
  {
    key: 'password-reset-customer',
    name: 'Password Reset (Customer)',
    description: 'Sent to customers when they request a password reset.',
  },
  {
    key: 'customer-welcome',
    name: 'Customer Welcome',
    description: 'Sent to new customers after registration.',
  },
  {
    key: 'abandoned-cart',
    name: 'Abandoned Cart',
    description: 'Sent to customers who left items in their cart.',
  },
];

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export async function loader({ request }) {
  const adminLocale = await getRequestLocale(request);

  const [settings, users] = await Promise.all([
    getAdminSettingsSnapshot(),
    prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        emailVerified: true,
      },
    }),
  ]);

  return {
    ...settings,
    adminLocale,
    adminAvailableLocales: ADMIN_AVAILABLE_LOCALES,
    users: users.map((u) => ({
      ...u,
      createdAt: u.createdAt.toISOString(),
    })),
  };
}

// ---------------------------------------------------------------------------
// Action
// ---------------------------------------------------------------------------

export async function action({ request }) {
  const formData = await request.formData();
  const intent = formData.get('intent');

  // ── General ────────────────────────────────────────────────────────────────
  if (intent === 'save-general') {
    await saveGeneralSettings({
      shopName: formData.get('shopName'),
      contactEmail: formData.get('contactEmail'),
    });
    return { ok: true, intent };
  }

  // ── SEO ────────────────────────────────────────────────────────────────────
  if (intent === 'save-seo') {
    await saveSeoSettings(
      parseSeoSettingsInput({
        metaTitle: formData.get('metaTitle'),
        metaDescription: formData.get('metaDescription'),
        titleTemplate: formData.get('titleTemplate'),
        allowIndexing: formData.get('allowIndexing') === 'on',
        googleSiteVerification: formData.get('googleSiteVerification'),
        bingSiteVerification: formData.get('bingSiteVerification'),
        twitterHandle: formData.get('twitterHandle'),
      })
    );
    return { ok: true, intent };
  }

  if (intent === 'upload-seo-image') {
    const file = formData.get('file');
    if (!file || typeof file === 'string') {
      return { ok: false, error: 'No file provided.', intent };
    }

    const { url } = await uploadMedia(file);
    await set('seo.ogImageUrl', url);
    return { ok: true, intent, ogImageUrl: url };
  }

  if (intent === 'remove-seo-image') {
    await set('seo.ogImageUrl', '');
    return { ok: true, intent };
  }

  // ── Currencies ─────────────────────────────────────────────────────────────
  if (intent === 'save-currencies') {
    await saveCurrencySettings({
      currencies: formData.getAll('currencies').map(String),
      defaultCurrency: formData.get('defaultCurrency'),
    });
    return { ok: true, intent };
  }

  // ── Locales ────────────────────────────────────────────────────────────────
  if (intent === 'save-locales') {
    await saveLocaleSettings({
      locales: formData.getAll('locales').map(String),
      defaultLocale: formData.get('defaultLocale'),
    });
    return { ok: true, intent };
  }

  // ── Tax ────────────────────────────────────────────────────────────────────
  if (intent === 'save-tax') {
    await saveTaxSettings({
      taxMode: formData.get('taxMode'),
      taxRegions: formData.get('taxRegions'),
    });
    return { ok: true, intent };
  }

  // ── Shipping ───────────────────────────────────────────────────────────────
  if (intent === 'save-shipping') {
    await saveShippingSettings({
      shippingZones: formData.get('shippingZones'),
    });
    return { ok: true, intent };
  }

  // ── Change Role ────────────────────────────────────────────────────────────
  if (intent === 'change-role') {
    const session = await authenticate(request);
    if (!(await hasPermission(session.user.role, 'settings:manage'))) {
      return { ok: false, error: 'Forbidden', intent };
    }

    const userId = formData.get('userId')?.toString();
    const newRole = formData.get('role')?.toString();
    if (!userId || !newRole)
      return { ok: false, error: 'Missing userId or role.', intent };
    await prisma.user.update({
      where: { id: userId },
      data: { role: newRole },
    });
    return { ok: true, intent };
  }

  return { ok: false, error: 'Unknown intent.' };
}

// ---------------------------------------------------------------------------
// Shared helpers / sub-components
// ---------------------------------------------------------------------------

function inputClass(extra) {
  return clsx(controlClasses, extra);
}

function selectClass() {
  return clsx(controlClasses, 'pr-8');
}

function SaveButton({ fetcher, intent, label = 'Save' }) {
  const busy = fetcher.state !== 'idle';
  const saved =
    fetcher.state === 'idle' &&
    fetcher.data?.ok &&
    fetcher.data?.intent === intent;
  return (
    <div className="flex items-center gap-3">
      <Button type="submit" disabled={busy}>
        {busy ? 'Saving…' : label}
      </Button>
      {saved && (
        <span className="text-success flex items-center gap-1 text-sm">
          <CheckIcon className="h-4 w-4" />
          Saved
        </span>
      )}
      {fetcher.state === 'idle' &&
        fetcher.data &&
        !fetcher.data.ok &&
        fetcher.data?.intent === intent && (
          <span className="text-danger text-sm">
            {fetcher.data.error ?? 'Error saving.'}
          </span>
        )}
    </div>
  );
}

function SectionCard({ title, children }) {
  return (
    <Card padded={false}>
      <div className="border-border border-b px-4 py-4 sm:px-6">
        <h2 className="text-text text-base font-semibold">{title}</h2>
      </div>
      <div className="p-4 sm:p-6">{children}</div>
    </Card>
  );
}

function FieldLabel({ children }) {
  return (
    <label className="text-text mb-1 block text-sm font-medium">
      {children}
    </label>
  );
}

// ---------------------------------------------------------------------------
// Tab: General
// ---------------------------------------------------------------------------

function AdminLocaleField({ adminLocale, availableLocales }) {
  const fetcher = useFetcher();
  const location = useLocation();
  const returnTo = location.pathname + location.search;

  if (!availableLocales || availableLocales.length <= 1) return null;

  return (
    <fetcher.Form method="post" action="/api/set-locale">
      <input type="hidden" name="returnTo" value={returnTo} />
      <FieldLabel>Admin Interface Language</FieldLabel>
      <select
        name="locale"
        defaultValue={adminLocale}
        onChange={(event) => event.currentTarget.form.requestSubmit()}
        className={selectClass()}
      >
        {availableLocales.map((locale) => (
          <option key={locale} value={locale}>
            {LOCALE_LABELS[locale] ?? locale}
          </option>
        ))}
      </select>
      <p className="text-text-muted mt-1 text-xs">
        Language used in the admin back office.
      </p>
    </fetcher.Form>
  );
}

function GeneralTab({ data }) {
  const fetcher = useFetcher();

  return (
    <SectionCard title="General Settings">
      <div className="max-w-lg space-y-6">
        <fetcher.Form method="post" className="space-y-4">
          <input type="hidden" name="intent" value="save-general" />
          <div>
            <FieldLabel>Shop Name</FieldLabel>
            <input
              type="text"
              name="shopName"
              defaultValue={data.shopName}
              placeholder="My Awesome Store"
              className={inputClass()}
            />
          </div>
          <div>
            <FieldLabel>Contact Email</FieldLabel>
            <input
              type="email"
              name="contactEmail"
              defaultValue={data.contactEmail}
              placeholder="hello@example.com"
              className={inputClass()}
            />
          </div>
          <div>
            <FieldLabel>Default Locale</FieldLabel>
            <select
              name="defaultLocale"
              defaultValue={data.defaultLocale}
              className={selectClass()}
            >
              {(data.locales.length > 0 ? data.locales : LOCALE_OPTIONS).map(
                (l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                )
              )}
            </select>
          </div>
          <div>
            <FieldLabel>Default Currency</FieldLabel>
            <select
              name="defaultCurrency"
              defaultValue={data.defaultCurrency}
              className={selectClass()}
            >
              {(data.currencies.length > 0
                ? data.currencies
                : AVAILABLE_CURRENCIES
              ).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <SaveButton fetcher={fetcher} intent="save-general" />
        </fetcher.Form>

        <AdminLocaleField
          adminLocale={data.adminLocale}
          availableLocales={data.adminAvailableLocales}
        />
      </div>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Tab: SEO
// ---------------------------------------------------------------------------

function SeoImageUploader({ imageUrl }) {
  const fetcher = useFetcher();
  const { revalidate } = useRevalidator();
  const fileRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState(imageUrl);

  useEffect(() => {
    setPreviewUrl(imageUrl);
  }, [imageUrl]);

  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data?.ok) {
      if (
        fetcher.data.intent === 'upload-seo-image' &&
        fetcher.data.ogImageUrl
      ) {
        setPreviewUrl(fetcher.data.ogImageUrl);
      }
      if (fetcher.data.intent === 'remove-seo-image') {
        setPreviewUrl('');
      }
      revalidate();
    }
  }, [fetcher.state, fetcher.data, revalidate]);

  function handleFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('intent', 'upload-seo-image');
    fd.append('file', file);
    fetcher.submit(fd, { method: 'post', encType: 'multipart/form-data' });
    if (fileRef.current) fileRef.current.value = '';
  }

  function handleRemove() {
    const fd = new FormData();
    fd.append('intent', 'remove-seo-image');
    fetcher.submit(fd, { method: 'post' });
  }

  const isUploading =
    fetcher.state !== 'idle' &&
    fetcher.formData?.get('intent') === 'upload-seo-image';
  const isRemoving =
    fetcher.state !== 'idle' &&
    fetcher.formData?.get('intent') === 'remove-seo-image';

  return (
    <div>
      <FieldLabel>Social / hero image</FieldLabel>
      <p className="text-text-muted mb-3 text-xs">
        Used for Open Graph and Twitter cards when pages do not have their own
        image. Recommended size: 1200×630 px.
      </p>

      {previewUrl ? (
        <div className="border-border bg-surface-2 relative max-w-md overflow-hidden rounded-lg border">
          <img
            src={previewUrl}
            alt="SEO hero preview"
            className="aspect-[1200/630] w-full object-cover"
          />
          <button
            type="button"
            onClick={handleRemove}
            disabled={isRemoving}
            className="bg-surface/90 text-text hover:text-danger absolute top-2 right-2 rounded-md p-1.5 shadow-sm transition disabled:opacity-50"
            aria-label="Remove image"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <label
          className={clsx(
            'border-border text-text-muted hover:border-accent hover:bg-accent/5 hover:text-accent flex max-w-md cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 transition-colors',
            isUploading && 'cursor-wait opacity-60'
          )}
        >
          {isUploading ? (
            <span className="text-sm">Uploading…</span>
          ) : (
            <>
              <PhotoIcon className="h-8 w-8" />
              <span className="mt-2 text-sm font-medium">Upload image</span>
            </>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={handleFileChange}
            disabled={isUploading}
          />
        </label>
      )}

      {previewUrl && (
        <div className="mt-3">
          <label
            className={clsx(
              'text-accent inline-flex cursor-pointer items-center gap-1 text-sm hover:underline',
              isUploading && 'cursor-wait opacity-60'
            )}
          >
            {isUploading ? 'Uploading…' : 'Replace image'}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handleFileChange}
              disabled={isUploading}
            />
          </label>
        </div>
      )}
    </div>
  );
}

function SeoTab({ data }) {
  const fetcher = useFetcher();

  return (
    <SectionCard title="SEO">
      <fetcher.Form method="post" className="max-w-lg space-y-6">
        <input type="hidden" name="intent" value="save-seo" />

        <p className="text-text-muted text-sm">
          Default title and description for your storefront homepage and social
          previews. Product and content pages can override these with their own
          SEO fields.
        </p>

        <div>
          <FieldLabel>Meta title</FieldLabel>
          <input
            type="text"
            name="metaTitle"
            defaultValue={data.seoMetaTitle}
            placeholder={data.shopName || 'My Awesome Store'}
            className={inputClass()}
          />
          <p className="text-text-muted mt-1 text-xs">
            Shown in browser tabs and search results. Falls back to shop name
            when empty.
          </p>
        </div>

        <div>
          <FieldLabel>Meta description</FieldLabel>
          <textarea
            name="metaDescription"
            defaultValue={data.seoMetaDescription}
            rows={3}
            placeholder="Discover our curated collection…"
            className={inputClass('resize-y')}
          />
          <p className="text-text-muted mt-1 text-xs">
            Short summary for search engines and link previews (aim for ~160
            characters).
          </p>
        </div>

        <div>
          <FieldLabel>Title template</FieldLabel>
          <input
            type="text"
            name="titleTemplate"
            defaultValue={data.seoTitleTemplate}
            placeholder="{pageTitle} | {shopName}"
            className={inputClass()}
          />
          <p className="text-text-muted mt-1 text-xs">
            Applied to product, category, and content pages. Use{' '}
            <code className="text-text">{`{pageTitle}`}</code> and{' '}
            <code className="text-text">{`{shopName}`}</code>. The homepage uses
            the meta title above instead.
          </p>
        </div>

        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            name="allowIndexing"
            defaultChecked={data.seoAllowIndexing}
            className={clsx(CHECKBOX_CLASS, 'mt-0.5')}
          />
          <span>
            <span className="text-text block text-sm font-medium">
              Allow search engines to index this store
            </span>
            <span className="text-text-muted mt-0.5 block text-xs">
              Turn off for staging or pre-launch sites. Adds{' '}
              <code className="text-text">noindex</code> site-wide and blocks
              crawlers in robots.txt.
            </span>
          </span>
        </label>

        <div className="border-border border-t pt-6">
          <h3 className="text-text mb-4 text-sm font-semibold">
            Search engine verification
          </h3>
          <div className="space-y-4">
            <div>
              <FieldLabel>Google Search Console</FieldLabel>
              <input
                type="text"
                name="googleSiteVerification"
                defaultValue={data.seoGoogleSiteVerification}
                placeholder="verification token"
                className={inputClass()}
              />
              <p className="text-text-muted mt-1 text-xs">
                Content value from the HTML meta tag Google provides.
              </p>
            </div>
            <div>
              <FieldLabel>Bing Webmaster Tools</FieldLabel>
              <input
                type="text"
                name="bingSiteVerification"
                defaultValue={data.seoBingSiteVerification}
                placeholder="verification token"
                className={inputClass()}
              />
            </div>
          </div>
        </div>

        <div>
          <FieldLabel>Twitter / X handle</FieldLabel>
          <input
            type="text"
            name="twitterHandle"
            defaultValue={data.seoTwitterHandle}
            placeholder="myshop"
            className={inputClass()}
          />
          <p className="text-text-muted mt-1 text-xs">
            Optional. Used for <code className="text-text">twitter:site</code>{' '}
            on shared links (with or without @).
          </p>
        </div>

        <SaveButton fetcher={fetcher} intent="save-seo" />
      </fetcher.Form>

      <div className="border-border mt-8 max-w-lg border-t pt-8">
        <SeoImageUploader imageUrl={data.seoOgImageUrl} />
      </div>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Tab: Currencies
// ---------------------------------------------------------------------------

function CurrenciesTab({ data }) {
  const fetcher = useFetcher();
  const [enabled, setEnabled] = useState(data.currencies);
  const [defaultCurrency, setDefaultCurrency] = useState(data.defaultCurrency);

  function toggle(c) {
    setEnabled((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    );
  }

  return (
    <SectionCard title="Currencies">
      <fetcher.Form method="post" className="space-y-4">
        <input type="hidden" name="intent" value="save-currencies" />
        {enabled.map((c) => (
          <input key={c} type="hidden" name="currencies" value={c} />
        ))}
        <input type="hidden" name="defaultCurrency" value={defaultCurrency} />

        <p className="text-text-muted text-sm">
          Enable or disable currencies. The default is used as the primary
          storefront currency.
        </p>

        <Table>
          <THead>
            <tr>
              <Th>Currency</Th>
              <Th className="text-center">Enabled</Th>
              <Th className="text-center">Default</Th>
            </tr>
          </THead>
          <TBody>
            {AVAILABLE_CURRENCIES.map((c) => {
              const isEnabled = enabled.includes(c);
              const isDefault = defaultCurrency === c;
              return (
                <tr key={c}>
                  <Td className="text-text font-mono font-semibold">{c}</Td>
                  <Td className="text-center">
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={() => toggle(c)}
                      className={CHECKBOX_CLASS}
                    />
                  </Td>
                  <Td className="text-center">
                    <input
                      type="radio"
                      checked={isDefault}
                      disabled={!isEnabled}
                      onChange={() => setDefaultCurrency(c)}
                      className={clsx(RADIO_CLASS, 'disabled:opacity-40')}
                    />
                  </Td>
                </tr>
              );
            })}
          </TBody>
        </Table>

        <SaveButton fetcher={fetcher} intent="save-currencies" />
      </fetcher.Form>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Tab: Locales
// ---------------------------------------------------------------------------

function LocalesTab({ data }) {
  const fetcher = useFetcher();
  const [enabled, setEnabled] = useState(data.locales);
  const [defaultLocale, setDefaultLocale] = useState(data.defaultLocale);

  function toggle(l) {
    setEnabled((prev) =>
      prev.includes(l) ? prev.filter((x) => x !== l) : [...prev, l]
    );
  }

  return (
    <SectionCard title="Locales">
      <fetcher.Form method="post" className="space-y-4">
        <input type="hidden" name="intent" value="save-locales" />
        {enabled.map((l) => (
          <input key={l} type="hidden" name="locales" value={l} />
        ))}
        <input type="hidden" name="defaultLocale" value={defaultLocale} />

        <p className="text-text-muted text-sm">
          Enable locales for your storefront. The default locale is used when no
          locale is detected.
        </p>

        <Table>
          <THead>
            <tr>
              <Th>Locale</Th>
              <Th className="text-center">Enabled</Th>
              <Th className="text-center">Default</Th>
            </tr>
          </THead>
          <TBody>
            {LOCALE_OPTIONS.map((l) => {
              const isEnabled = enabled.includes(l);
              const isDefault = defaultLocale === l;
              return (
                <tr key={l}>
                  <Td className="text-text font-mono font-semibold">{l}</Td>
                  <Td className="text-center">
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={() => toggle(l)}
                      className={CHECKBOX_CLASS}
                    />
                  </Td>
                  <Td className="text-center">
                    <input
                      type="radio"
                      checked={isDefault}
                      disabled={!isEnabled}
                      onChange={() => setDefaultLocale(l)}
                      className={clsx(RADIO_CLASS, 'disabled:opacity-40')}
                    />
                  </Td>
                </tr>
              );
            })}
          </TBody>
        </Table>

        <SaveButton fetcher={fetcher} intent="save-locales" />
      </fetcher.Form>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Tab: Tax
// ---------------------------------------------------------------------------

function TaxTab({ data }) {
  const fetcher = useFetcher();
  const [taxMode, setTaxMode] = useState(data.taxMode);
  const [regions, setRegions] = useState(
    data.taxRegions.map((r, i) => ({ ...r, _key: i }))
  );

  function addRegion() {
    setRegions((prev) => [
      ...prev,
      { _key: Date.now(), country: '', percent: 0 },
    ]);
  }

  function removeRegion(key) {
    setRegions((prev) => prev.filter((r) => r._key !== key));
  }

  function updateRegion(key, field, value) {
    setRegions((prev) =>
      prev.map((r) => (r._key === key ? { ...r, [field]: value } : r))
    );
  }

  const regionsForSubmit = regions.map(({ country, percent }) => ({
    country,
    percent: parseFloat(percent) || 0,
  }));

  return (
    <SectionCard title="Tax Settings">
      <fetcher.Form method="post" className="space-y-6">
        <input type="hidden" name="intent" value="save-tax" />
        <input type="hidden" name="taxMode" value={taxMode} />
        <input
          type="hidden"
          name="taxRegions"
          value={JSON.stringify(regionsForSubmit)}
        />

        {/* Tax mode */}
        <div>
          <FieldLabel>Tax Mode</FieldLabel>
          <div className="mt-1 flex gap-6">
            {['inclusive', 'exclusive'].map((mode) => (
              <label
                key={mode}
                className="flex cursor-pointer items-center gap-2"
              >
                <input
                  type="radio"
                  name="taxModeRadio"
                  value={mode}
                  checked={taxMode === mode}
                  onChange={() => setTaxMode(mode)}
                  className={RADIO_CLASS}
                />
                <span className="text-text text-sm capitalize">{mode}</span>
              </label>
            ))}
          </div>
          <p className="text-text-muted mt-1 text-xs">
            {taxMode === 'inclusive'
              ? 'Prices already include tax.'
              : 'Tax is added on top of prices at checkout.'}
          </p>
        </div>

        {/* Tax regions */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <FieldLabel>Tax Regions</FieldLabel>
            <button
              type="button"
              onClick={addRegion}
              className="text-accent inline-flex items-center gap-1 text-sm hover:underline"
            >
              <PlusIcon className="h-4 w-4" />
              Add region
            </button>
          </div>

          {regions.length === 0 ? (
            <p className="text-text-muted text-sm italic">
              No tax regions configured.
            </p>
          ) : (
            <div className="space-y-2">
              {regions.map((r) => (
                <div key={r._key} className="flex items-center gap-3">
                  <input
                    type="text"
                    value={r.country}
                    onChange={(e) =>
                      updateRegion(r._key, 'country', e.target.value)
                    }
                    placeholder="Country code (e.g. US)"
                    maxLength={3}
                    className={inputClass('w-40 uppercase')}
                  />
                  <input
                    type="number"
                    value={r.percent}
                    onChange={(e) =>
                      updateRegion(r._key, 'percent', e.target.value)
                    }
                    placeholder="%"
                    min="0"
                    max="100"
                    step="0.01"
                    className={inputClass('w-24')}
                  />
                  <span className="text-text-muted text-sm">%</span>
                  <button
                    type="button"
                    onClick={() => removeRegion(r._key)}
                    className="text-text-muted hover:text-danger rounded p-1"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <SaveButton fetcher={fetcher} intent="save-tax" />
      </fetcher.Form>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Tab: Shipping
// ---------------------------------------------------------------------------

function ShippingTab({ data }) {
  const fetcher = useFetcher();
  const [zones, setZones] = useState(
    data.shippingZones.map((z, i) => ({
      ...z,
      name: z.name ?? z.label ?? '',
      id: z.id ?? null,
      _key: i,
    }))
  );

  function addZone() {
    setZones((prev) => [
      ...prev,
      {
        _key: Date.now(),
        name: '',
        countries: '',
        rateCents: 0,
        freeOverCents: '',
      },
    ]);
  }

  function removeZone(key) {
    setZones((prev) => prev.filter((z) => z._key !== key));
  }

  function updateZone(key, field, value) {
    setZones((prev) =>
      prev.map((z) => (z._key === key ? { ...z, [field]: value } : z))
    );
  }

  const zonesForSubmit = zones.map(
    (
      { id, name, countries, rateCents, freeOverCents, estimatedDays },
      index
    ) => {
      const trimmedName = name?.trim() ?? '';
      const slug =
        trimmedName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_|_$/g, '') || `zone_${index}`;

      return {
        id: id || slug,
        name: trimmedName,
        countries:
          typeof countries === 'string'
            ? countries
            : Array.isArray(countries)
              ? countries.join(', ')
              : '',
        rateCents,
        freeOverCents,
        estimatedDays,
      };
    }
  );

  return (
    <SectionCard title="Shipping Zones">
      <fetcher.Form method="post" className="space-y-6">
        <input type="hidden" name="intent" value="save-shipping" />
        <input
          type="hidden"
          name="shippingZones"
          value={JSON.stringify(zonesForSubmit)}
        />

        <p className="text-text-muted text-sm">
          Configure shipping zones with flat rates and optional free-shipping
          thresholds.
        </p>

        <div className="flex items-center justify-between">
          <span className="text-text text-sm font-medium">
            {zones.length} zone{zones.length !== 1 ? 's' : ''}
          </span>
          <button
            type="button"
            onClick={addZone}
            className="text-accent inline-flex items-center gap-1 text-sm hover:underline"
          >
            <PlusIcon className="h-4 w-4" />
            Add zone
          </button>
        </div>

        {zones.length === 0 ? (
          <p className="text-text-muted text-sm italic">
            No shipping zones configured.
          </p>
        ) : (
          <div className="space-y-3">
            {zones.map((z) => {
              const countriesStr =
                typeof z.countries === 'string'
                  ? z.countries
                  : Array.isArray(z.countries)
                    ? z.countries.join(', ')
                    : '';
              return (
                <div
                  key={z._key}
                  className="border-border space-y-3 rounded-lg border p-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-text text-sm font-medium">Zone</span>
                    <button
                      type="button"
                      onClick={() => removeZone(z._key)}
                      className="text-text-muted hover:text-danger rounded p-1"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="text-text-muted mb-1 block text-xs font-medium">
                        Zone name
                      </label>
                      <input
                        type="text"
                        value={z.name}
                        onChange={(e) =>
                          updateZone(z._key, 'name', e.target.value)
                        }
                        placeholder="US Domestic"
                        className={inputClass()}
                      />
                    </div>
                    <div>
                      <label className="text-text-muted mb-1 block text-xs font-medium">
                        Countries (comma-separated codes)
                      </label>
                      <input
                        type="text"
                        value={countriesStr}
                        onChange={(e) =>
                          updateZone(z._key, 'countries', e.target.value)
                        }
                        placeholder="US, CA"
                        className={inputClass('uppercase')}
                      />
                    </div>
                    <div>
                      <label className="text-text-muted mb-1 block text-xs font-medium">
                        Rate (cents)
                      </label>
                      <input
                        type="number"
                        value={z.rateCents}
                        onChange={(e) =>
                          updateZone(z._key, 'rateCents', e.target.value)
                        }
                        placeholder="999"
                        min="0"
                        className={inputClass()}
                      />
                    </div>
                    <div>
                      <label className="text-text-muted mb-1 block text-xs font-medium">
                        Free over (cents, optional)
                      </label>
                      <input
                        type="number"
                        value={z.freeOverCents ?? ''}
                        onChange={(e) =>
                          updateZone(z._key, 'freeOverCents', e.target.value)
                        }
                        placeholder="5000"
                        min="0"
                        className={inputClass()}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <SaveButton fetcher={fetcher} intent="save-shipping" />
      </fetcher.Form>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Tab: Admin Users
// ---------------------------------------------------------------------------

function AdminUsersTab({ data }) {
  const roleFetcher = useFetcher();

  return (
    <div className="space-y-6">
      <SectionCard title="Admin Users">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-text-muted text-sm">
            {data.users.length} user{data.users.length !== 1 ? 's' : ''}
          </p>
          <Link
            to="/admin/settings/users/new"
            className="bg-accent text-accent-fg hover:bg-accent-hover focus-visible:outline-accent inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-semibold shadow-sm transition focus-visible:outline focus-visible:outline-offset-2"
          >
            <UserPlusIcon className="h-4 w-4" />
            Invite admin
          </Link>
        </div>

        {/* Users table */}
        <Table>
          <THead>
            <tr>
              <Th>Name</Th>
              <Th>Email</Th>
              <Th>Role</Th>
              <Th>Verified</Th>
              <Th>Joined</Th>
              <Th>Actions</Th>
            </tr>
          </THead>
          <TBody>
            {data.users.length === 0 && (
              <tr>
                <Td colSpan={6} className="py-8 text-center">
                  No admin users found.
                </Td>
              </tr>
            )}
            {data.users.map((user) => (
              <tr key={user.id}>
                <Td className="text-text font-medium">{user.name || '—'}</Td>
                <Td className="text-text">{user.email}</Td>
                <Td>
                  <Badge tone={user.role === 'admin' ? 'accent' : 'neutral'}>
                    {user.role}
                  </Badge>
                </Td>
                <Td>
                  <Badge tone={user.emailVerified ? 'success' : 'warn'}>
                    {user.emailVerified ? 'Verified' : 'Pending'}
                  </Badge>
                </Td>
                <Td>
                  {new Date(user.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </Td>
                <Td>
                  <roleFetcher.Form method="post" className="inline">
                    <input type="hidden" name="intent" value="change-role" />
                    <input type="hidden" name="userId" value={user.id} />
                    <input
                      type="hidden"
                      name="role"
                      value={user.role === 'admin' ? 'staff' : 'admin'}
                    />
                    <button
                      type="submit"
                      disabled={roleFetcher.state !== 'idle'}
                      className="text-accent text-xs hover:underline disabled:opacity-50"
                      title={`Switch to ${user.role === 'admin' ? 'staff' : 'admin'}`}
                    >
                      {user.role === 'admin' ? 'Make staff' : 'Make admin'}
                    </button>
                  </roleFetcher.Form>
                </Td>
              </tr>
            ))}
          </TBody>
        </Table>
      </SectionCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Email Templates Preview
// ---------------------------------------------------------------------------

function EmailTemplatesTab() {
  return (
    <SectionCard title="Email Templates">
      <p className="text-text-muted mb-4 text-sm">
        These are the available email templates. Preview links will be active in
        a future update.
      </p>
      <div className="space-y-3">
        {EMAIL_TEMPLATES.map((tpl) => (
          <div
            key={tpl.key}
            className="border-border flex items-start justify-between rounded-lg border px-4 py-3"
          >
            <div>
              <p className="text-text text-sm font-medium">{tpl.name}</p>
              <p className="text-text-muted mt-0.5 text-xs">
                {tpl.description}
              </p>
            </div>
            <span
              className="text-text-muted ml-4 shrink-0 text-xs italic"
              title="Preview not yet available"
            >
              Preview coming soon
            </span>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function AdminSettingsRoute() {
  const data = useLoaderData();
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Manage your shop configuration."
        className="mb-6"
      />

      {/* Tab nav */}
      <Tabs
        tabs={TABS}
        active={activeTab}
        onChange={setActiveTab}
        className="mb-6"
      />

      {/* Tab content */}
      {activeTab === 0 && <GeneralTab data={data} />}
      {activeTab === 1 && <SeoTab data={data} />}
      {activeTab === 2 && <CurrenciesTab data={data} />}
      {activeTab === 3 && <LocalesTab data={data} />}
      {activeTab === 4 && <TaxTab data={data} />}
      {activeTab === 5 && <ShippingTab data={data} />}
      {activeTab === 6 && <AdminUsersTab data={data} />}
      {activeTab === 7 && <EmailTemplatesTab />}
    </div>
  );
}
