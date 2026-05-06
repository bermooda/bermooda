// app/routes/admin/settings/index.jsx
// Multi-section settings admin: General, Currencies, Locales, Tax, Shipping,
// Admin Users, Email Templates Preview.

import {
  CheckIcon,
  PlusIcon,
  TrashIcon,
  UserPlusIcon,
} from '@heroicons/react/24/outline';
import bcrypt from 'bcryptjs';
import clsx from 'clsx';
import { useState } from 'react';
import { useFetcher, useLoaderData } from 'react-router';

import prisma from '#/libs/prisma.server';

import { get, set } from '#/core/settings/index.server';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALL_CURRENCIES = ['USD', 'EUR', 'AUD', 'GBP', 'CAD', 'JPY'];
const ALL_LOCALES = ['en', 'de', 'fr', 'es', 'pt', 'ja'];

const TABS = [
  'General',
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

export async function loader() {
  const [
    shopName,
    contactEmail,
    defaultCurrency,
    defaultLocale,
    currencies,
    locales,
    taxMode,
    taxRegions,
    shippingZones,
    users,
  ] = await Promise.all([
    get('shopName'),
    get('contactEmail'),
    get('defaultCurrency'),
    get('defaultLocale'),
    get('currencies'),
    get('locales'),
    get('tax.mode'),
    get('tax.regions'),
    get('shipping.zones'),
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
    shopName: shopName ?? '',
    contactEmail: contactEmail ?? '',
    defaultCurrency: defaultCurrency ?? 'USD',
    defaultLocale: defaultLocale ?? 'en',
    currencies: currencies ?? ['USD', 'EUR', 'AUD'],
    locales: locales ?? ['en'],
    taxMode: taxMode ?? 'exclusive',
    taxRegions: taxRegions ?? [],
    shippingZones: shippingZones ?? [],
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
    const shopName = formData.get('shopName')?.toString().trim() ?? '';
    const contactEmail = formData.get('contactEmail')?.toString().trim() ?? '';
    await Promise.all([
      set('shopName', shopName),
      set('contactEmail', contactEmail),
    ]);
    return { ok: true, intent };
  }

  // ── Currencies ─────────────────────────────────────────────────────────────
  if (intent === 'save-currencies') {
    const enabled = formData.getAll('currencies').map(String);
    const defaultCurrency =
      formData.get('defaultCurrency')?.toString() ?? 'USD';
    await Promise.all([
      set('currencies', enabled),
      set('defaultCurrency', defaultCurrency),
    ]);
    return { ok: true, intent };
  }

  // ── Locales ────────────────────────────────────────────────────────────────
  if (intent === 'save-locales') {
    const enabled = formData.getAll('locales').map(String);
    const defaultLocale = formData.get('defaultLocale')?.toString() ?? 'en';
    await Promise.all([
      set('locales', enabled),
      set('defaultLocale', defaultLocale),
    ]);
    return { ok: true, intent };
  }

  // ── Tax ────────────────────────────────────────────────────────────────────
  if (intent === 'save-tax') {
    const taxMode = formData.get('taxMode')?.toString() ?? 'exclusive';
    const regionsJson = formData.get('taxRegions')?.toString() ?? '[]';
    let regions = [];
    try {
      regions = JSON.parse(regionsJson);
    } catch {
      // ignore malformed
    }
    await Promise.all([set('tax.mode', taxMode), set('tax.regions', regions)]);
    return { ok: true, intent };
  }

  // ── Shipping ───────────────────────────────────────────────────────────────
  if (intent === 'save-shipping') {
    const zonesJson = formData.get('shippingZones')?.toString() ?? '[]';
    let zones = [];
    try {
      zones = JSON.parse(zonesJson);
    } catch {
      // ignore malformed
    }
    await set('shipping.zones', zones);
    return { ok: true, intent };
  }

  // ── Invite Admin ───────────────────────────────────────────────────────────
  if (intent === 'invite-admin') {
    const email = formData.get('email')?.toString().trim() ?? '';
    const name = formData.get('name')?.toString().trim() ?? '';
    if (!email) return { ok: false, error: 'Email is required.', intent };

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing)
      return {
        ok: false,
        error: 'A user with that email already exists.',
        intent,
      };

    const hashedPassword = await bcrypt.hash('ChangeMe123!', 10);
    const user = await prisma.user.create({
      data: {
        email,
        name: name || email,
        role: 'staff',
        emailVerified: false,
      },
    });
    await prisma.account.create({
      data: {
        accountId: user.id,
        providerId: 'credential',
        userId: user.id,
        password: hashedPassword,
      },
    });

    return { ok: true, intent, newUserId: user.id };
  }

  // ── Change Role ────────────────────────────────────────────────────────────
  if (intent === 'change-role') {
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
  return clsx(
    'block w-full rounded-md border-0 bg-white px-3 py-1.5 text-sm text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 dark:bg-zinc-800 dark:text-white dark:ring-zinc-600 dark:placeholder:text-zinc-500',
    extra
  );
}

function selectClass() {
  return 'block w-full rounded-md border-0 bg-white px-3 py-1.5 text-sm text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 dark:bg-zinc-800 dark:text-white dark:ring-zinc-600';
}

function SaveButton({ fetcher, intent, label = 'Save' }) {
  const busy = fetcher.state !== 'idle';
  const saved =
    fetcher.state === 'idle' &&
    fetcher.data?.ok &&
    fetcher.data?.intent === intent;
  return (
    <div className="flex items-center gap-3">
      <button
        type="submit"
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-60"
      >
        {busy ? 'Saving…' : label}
      </button>
      {saved && (
        <span className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
          <CheckIcon className="h-4 w-4" />
          Saved
        </span>
      )}
      {fetcher.state === 'idle' &&
        fetcher.data &&
        !fetcher.data.ok &&
        fetcher.data?.intent === intent && (
          <span className="text-sm text-red-600 dark:text-red-400">
            {fetcher.data.error ?? 'Error saving.'}
          </span>
        )}
    </div>
  );
}

function SectionCard({ title, children }) {
  return (
    <div className="rounded-lg bg-white shadow-sm ring-1 ring-gray-200 dark:bg-zinc-900 dark:ring-zinc-700">
      <div className="border-b border-gray-100 px-6 py-4 dark:border-zinc-800">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">
          {title}
        </h2>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

function FieldLabel({ children }) {
  return (
    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-zinc-300">
      {children}
    </label>
  );
}

// ---------------------------------------------------------------------------
// Tab: General
// ---------------------------------------------------------------------------

function GeneralTab({ data }) {
  const fetcher = useFetcher();

  return (
    <SectionCard title="General Settings">
      <fetcher.Form method="post" className="max-w-lg space-y-4">
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
            {(data.locales.length > 0 ? data.locales : ALL_LOCALES).map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
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
              : ALL_CURRENCIES
            ).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <SaveButton fetcher={fetcher} intent="save-general" />
      </fetcher.Form>
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

        <p className="text-sm text-gray-500 dark:text-zinc-400">
          Enable or disable currencies. The default is used as the primary
          storefront currency.
        </p>

        <div className="overflow-hidden rounded-lg ring-1 ring-gray-200 dark:ring-zinc-700">
          <table className="min-w-full divide-y divide-gray-100 dark:divide-zinc-800">
            <thead className="bg-gray-50 dark:bg-zinc-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-zinc-400">
                  Currency
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-zinc-400">
                  Enabled
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-zinc-400">
                  Default
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white dark:divide-zinc-800 dark:bg-zinc-900">
              {ALL_CURRENCIES.map((c) => {
                const isEnabled = enabled.includes(c);
                const isDefault = defaultCurrency === c;
                return (
                  <tr
                    key={c}
                    className="hover:bg-gray-50 dark:hover:bg-zinc-800/50"
                  >
                    <td className="px-4 py-3 font-mono text-sm font-semibold text-gray-900 dark:text-white">
                      {c}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={() => toggle(c)}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <input
                        type="radio"
                        checked={isDefault}
                        disabled={!isEnabled}
                        onChange={() => setDefaultCurrency(c)}
                        className="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-40"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

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

        <p className="text-sm text-gray-500 dark:text-zinc-400">
          Enable locales for your storefront. The default locale is used when no
          locale is detected.
        </p>

        <div className="overflow-hidden rounded-lg ring-1 ring-gray-200 dark:ring-zinc-700">
          <table className="min-w-full divide-y divide-gray-100 dark:divide-zinc-800">
            <thead className="bg-gray-50 dark:bg-zinc-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-zinc-400">
                  Locale
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-zinc-400">
                  Enabled
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-zinc-400">
                  Default
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white dark:divide-zinc-800 dark:bg-zinc-900">
              {ALL_LOCALES.map((l) => {
                const isEnabled = enabled.includes(l);
                const isDefault = defaultLocale === l;
                return (
                  <tr
                    key={l}
                    className="hover:bg-gray-50 dark:hover:bg-zinc-800/50"
                  >
                    <td className="px-4 py-3 font-mono text-sm font-semibold text-gray-900 dark:text-white">
                      {l}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={() => toggle(l)}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <input
                        type="radio"
                        checked={isDefault}
                        disabled={!isEnabled}
                        onChange={() => setDefaultLocale(l)}
                        className="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-40"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

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
                  className="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700 capitalize dark:text-zinc-300">
                  {mode}
                </span>
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-zinc-400">
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
              className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
            >
              <PlusIcon className="h-4 w-4" />
              Add region
            </button>
          </div>

          {regions.length === 0 ? (
            <p className="text-sm text-gray-400 italic dark:text-zinc-500">
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
                  <span className="text-sm text-gray-500 dark:text-zinc-400">
                    %
                  </span>
                  <button
                    type="button"
                    onClick={() => removeRegion(r._key)}
                    className="rounded p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400"
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
    data.shippingZones.map((z, i) => ({ ...z, _key: i }))
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
    ({ name, countries, rateCents, freeOverCents }) => ({
      name,
      countries:
        typeof countries === 'string'
          ? countries
              .split(',')
              .map((c) => c.trim().toUpperCase())
              .filter(Boolean)
          : countries,
      rateCents: parseInt(rateCents, 10) || 0,
      freeOverCents:
        freeOverCents !== '' && freeOverCents != null
          ? parseInt(freeOverCents, 10) || null
          : null,
    })
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

        <p className="text-sm text-gray-500 dark:text-zinc-400">
          Configure shipping zones with flat rates and optional free-shipping
          thresholds.
        </p>

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700 dark:text-zinc-300">
            {zones.length} zone{zones.length !== 1 ? 's' : ''}
          </span>
          <button
            type="button"
            onClick={addZone}
            className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
          >
            <PlusIcon className="h-4 w-4" />
            Add zone
          </button>
        </div>

        {zones.length === 0 ? (
          <p className="text-sm text-gray-400 italic dark:text-zinc-500">
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
                  className="space-y-3 rounded-lg border border-gray-200 p-4 dark:border-zinc-700"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700 dark:text-zinc-300">
                      Zone
                    </span>
                    <button
                      type="button"
                      onClick={() => removeZone(z._key)}
                      className="rounded p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-zinc-400">
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
                      <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-zinc-400">
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
                      <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-zinc-400">
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
                      <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-zinc-400">
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
  const inviteFetcher = useFetcher();
  const roleFetcher = useFetcher();
  const [showInvite, setShowInvite] = useState(false);

  const inviteSuccess =
    inviteFetcher.state === 'idle' &&
    inviteFetcher.data?.ok &&
    inviteFetcher.data?.intent === 'invite-admin';

  const inviteError =
    inviteFetcher.state === 'idle' &&
    inviteFetcher.data &&
    !inviteFetcher.data.ok &&
    inviteFetcher.data?.intent === 'invite-admin'
      ? inviteFetcher.data.error
      : null;

  return (
    <div className="space-y-6">
      <SectionCard title="Admin Users">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-gray-500 dark:text-zinc-400">
            {data.users.length} user{data.users.length !== 1 ? 's' : ''}
          </p>
          <button
            type="button"
            onClick={() => setShowInvite((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
          >
            <UserPlusIcon className="h-4 w-4" />
            Invite Admin
          </button>
        </div>

        {/* Invite form */}
        {showInvite && (
          <div className="mb-6 rounded-lg border border-indigo-200 bg-indigo-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/60">
            <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
              Invite new admin user
            </h3>

            {inviteSuccess && (
              <div className="mb-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">
                User created. Temporary password:{' '}
                <code className="font-mono font-bold">ChangeMe123!</code> — ask
                them to change it on first login.
              </div>
            )}
            {inviteError && (
              <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
                {inviteError}
              </div>
            )}

            <inviteFetcher.Form method="post" className="max-w-sm space-y-3">
              <input type="hidden" name="intent" value="invite-admin" />
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-zinc-400">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="admin@example.com"
                  className={inputClass()}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-zinc-400">
                  Name (optional)
                </label>
                <input
                  type="text"
                  name="name"
                  placeholder="Jane Smith"
                  className={inputClass()}
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={inviteFetcher.state !== 'idle'}
                  className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-60"
                >
                  {inviteFetcher.state !== 'idle' ? 'Creating…' : 'Create user'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowInvite(false)}
                  className="text-sm text-gray-500 hover:text-gray-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                >
                  Cancel
                </button>
              </div>
            </inviteFetcher.Form>
          </div>
        )}

        {/* Users table */}
        <div className="overflow-hidden rounded-lg ring-1 ring-gray-200 dark:ring-zinc-700">
          <table className="min-w-full divide-y divide-gray-100 dark:divide-zinc-800">
            <thead className="bg-gray-50 dark:bg-zinc-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-zinc-400">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-zinc-400">
                  Email
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-zinc-400">
                  Role
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-zinc-400">
                  Verified
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-zinc-400">
                  Joined
                </th>
                <th className="px-4 py-3 text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-zinc-400">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white dark:divide-zinc-800 dark:bg-zinc-900">
              {data.users.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-sm text-gray-400 dark:text-zinc-500"
                  >
                    No admin users found.
                  </td>
                </tr>
              )}
              {data.users.map((user) => (
                <tr
                  key={user.id}
                  className="hover:bg-gray-50 dark:hover:bg-zinc-800/50"
                >
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                    {user.name || '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-zinc-300">
                    {user.email}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={clsx(
                        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                        user.role === 'admin'
                          ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
                          : 'bg-gray-100 text-gray-700 dark:bg-zinc-700 dark:text-zinc-300'
                      )}
                    >
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={clsx(
                        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                        user.emailVerified
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                      )}
                    >
                      {user.emailVerified ? 'Verified' : 'Pending'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-zinc-400">
                    {new Date(user.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="px-4 py-3 text-center">
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
                        className="text-xs text-indigo-600 hover:text-indigo-500 disabled:opacity-50 dark:text-indigo-400"
                        title={`Switch to ${user.role === 'admin' ? 'staff' : 'admin'}`}
                      >
                        {user.role === 'admin' ? 'Make staff' : 'Make admin'}
                      </button>
                    </roleFetcher.Form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
      <p className="mb-4 text-sm text-gray-500 dark:text-zinc-400">
        These are the available email templates. Preview links will be active in
        a future update.
      </p>
      <div className="space-y-3">
        {EMAIL_TEMPLATES.map((tpl) => (
          <div
            key={tpl.key}
            className="flex items-start justify-between rounded-lg border border-gray-200 px-4 py-3 dark:border-zinc-700"
          >
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {tpl.name}
              </p>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-zinc-400">
                {tpl.description}
              </p>
            </div>
            <span
              className="ml-4 shrink-0 text-xs text-gray-400 italic dark:text-zinc-500"
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
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Settings
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Manage your shop configuration.
        </p>
      </div>

      {/* Tab nav */}
      <div className="mb-6 flex flex-wrap gap-1 border-b border-gray-200 dark:border-zinc-700">
        {TABS.map((tab, i) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(i)}
            className={clsx(
              'px-4 py-2 text-sm font-medium transition-colors focus:outline-none',
              activeTab === i
                ? 'border-b-2 border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                : 'text-gray-500 hover:text-gray-700 dark:text-zinc-400 dark:hover:text-zinc-200'
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 0 && <GeneralTab data={data} />}
      {activeTab === 1 && <CurrenciesTab data={data} />}
      {activeTab === 2 && <LocalesTab data={data} />}
      {activeTab === 3 && <TaxTab data={data} />}
      {activeTab === 4 && <ShippingTab data={data} />}
      {activeTab === 5 && <AdminUsersTab data={data} />}
      {activeTab === 6 && <EmailTemplatesTab />}
    </div>
  );
}
