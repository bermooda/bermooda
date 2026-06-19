// app/routes/admin/api-settings.jsx
// Admin UI for managing API keys and outbound webhook subscriptions.

import {
  CheckIcon,
  ClipboardDocumentIcon,
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { useState } from 'react';
import { useFetcher, useLoaderData } from 'react-router';

import { authenticate } from '#/libs/auth/admin.server';

import {
  createApiKey,
  listApiKeys,
  revokeApiKey,
} from '#/core/api-keys/index.server';
import {
  createSubscription,
  deleteSubscription,
  listSubscriptions,
  WEBHOOK_EVENTS,
} from '#/core/webhooks/index.server';

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export async function loader({ request }) {
  await authenticate(request);
  const [apiKeys, subscriptions] = await Promise.all([
    listApiKeys(),
    listSubscriptions(),
  ]);
  return { apiKeys, subscriptions, supportedEvents: WEBHOOK_EVENTS };
}

// ---------------------------------------------------------------------------
// Action
// ---------------------------------------------------------------------------

export async function action({ request }) {
  await authenticate(request);
  const formData = await request.formData();
  const intent = formData.get('intent');

  // ── Create API key ─────────────────────────────────────────────────────────
  if (intent === 'create-api-key') {
    const label = formData.get('label')?.toString().trim() ?? '';
    const scopesRaw = formData.getAll('scopes').map(String);
    const scopes = scopesRaw.length > 0 ? scopesRaw : ['admin'];

    if (!label) return { ok: false, intent, error: 'Label is required' };

    try {
      const { key, record } = await createApiKey({ label, scopes });
      return { ok: true, intent, key, record };
    } catch (err) {
      return { ok: false, intent, error: err.message };
    }
  }

  // ── Revoke API key ─────────────────────────────────────────────────────────
  if (intent === 'revoke-api-key') {
    const id = formData.get('id')?.toString();
    if (!id) return { ok: false, intent, error: 'Missing id' };
    try {
      await revokeApiKey(id);
      return { ok: true, intent };
    } catch (err) {
      return { ok: false, intent, error: err.message };
    }
  }

  // ── Create webhook subscription ────────────────────────────────────────────
  if (intent === 'create-webhook') {
    const url = formData.get('url')?.toString().trim() ?? '';
    const secret = formData.get('secret')?.toString().trim() ?? '';
    const label = formData.get('label')?.toString().trim() || undefined;
    const events = formData.getAll('events').map(String);

    if (!url) return { ok: false, intent, error: 'URL is required' };
    if (!secret) return { ok: false, intent, error: 'Secret is required' };
    if (events.length === 0)
      return { ok: false, intent, error: 'Select at least one event' };

    try {
      const subscription = await createSubscription({
        url,
        events,
        secret,
        label,
      });
      return { ok: true, intent, subscription };
    } catch (err) {
      return { ok: false, intent, error: err.message };
    }
  }

  // ── Delete webhook subscription ────────────────────────────────────────────
  if (intent === 'delete-webhook') {
    const id = formData.get('id')?.toString();
    if (!id) return { ok: false, intent, error: 'Missing id' };
    try {
      await deleteSubscription(id);
      return { ok: true, intent };
    } catch (err) {
      return { ok: false, intent, error: err.message };
    }
  }

  return { ok: false, error: 'Unknown intent' };
}

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

export function meta() {
  return [{ title: 'API Settings — bermooda Admin' }];
}

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

function inputClass(extra) {
  return clsx(
    'block w-full rounded-md border-0 bg-white px-3 py-1.5 text-sm text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 dark:bg-zinc-800 dark:text-white dark:ring-zinc-600 dark:placeholder:text-zinc-500',
    extra
  );
}

function SectionCard({ title, description, children }) {
  return (
    <div className="rounded-lg bg-white shadow-sm ring-1 ring-gray-200 dark:bg-zinc-900 dark:ring-zinc-700">
      <div className="border-b border-gray-100 px-6 py-4 dark:border-zinc-800">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">
          {title}
        </h2>
        {description && (
          <p className="mt-0.5 text-sm text-gray-500 dark:text-zinc-400">
            {description}
          </p>
        )}
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// API Keys section
// ---------------------------------------------------------------------------

function CopyButton({ value }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="ml-2 rounded p-1 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400"
      title="Copy to clipboard"
    >
      {copied ? (
        <CheckIcon className="h-4 w-4 text-green-500" />
      ) : (
        <ClipboardDocumentIcon className="h-4 w-4" />
      )}
    </button>
  );
}

function ApiKeysSection({ data }) {
  const [showCreate, setShowCreate] = useState(false);
  const [selectedScopes, setSelectedScopes] = useState(['admin']);
  const createFetcher = useFetcher();
  const revokeFetcher = useFetcher();

  const justCreated =
    createFetcher.state === 'idle' &&
    createFetcher.data?.ok &&
    createFetcher.data?.intent === 'create-api-key';

  const createError =
    createFetcher.state === 'idle' &&
    createFetcher.data &&
    !createFetcher.data.ok &&
    createFetcher.data?.intent === 'create-api-key'
      ? createFetcher.data.error
      : null;

  const AVAILABLE_SCOPES = ['admin', 'storefront'];

  return (
    <SectionCard
      title="API Keys"
      description="API keys authenticate requests to /api/admin/v1/* endpoints. Store keys securely — they are shown only once."
    >
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
        >
          <PlusIcon className="h-4 w-4" />
          Create key
        </button>
      </div>

      {showCreate && (
        <div className="mb-6 rounded-lg border border-indigo-100 bg-indigo-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/60">
          <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
            New API key
          </h3>

          {justCreated && createFetcher.data?.key && (
            <div className="mb-4 rounded-md bg-green-50 p-3 dark:bg-green-900/20">
              <p className="mb-1 text-sm font-semibold text-green-800 dark:text-green-300">
                Key created — copy it now, it won't be shown again:
              </p>
              <div className="flex items-center font-mono text-sm text-green-900 dark:text-green-200">
                <code className="break-all">{createFetcher.data.key}</code>
                <CopyButton value={createFetcher.data.key} />
              </div>
            </div>
          )}

          {createError && (
            <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
              {createError}
            </div>
          )}

          <createFetcher.Form method="post" className="max-w-sm space-y-3">
            <input type="hidden" name="intent" value="create-api-key" />
            {selectedScopes.map((s) => (
              <input key={s} type="hidden" name="scopes" value={s} />
            ))}

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-zinc-400">
                Label
              </label>
              <input
                type="text"
                name="label"
                placeholder="My integration"
                required
                className={inputClass()}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-zinc-400">
                Scopes
              </label>
              <div className="flex gap-4">
                {AVAILABLE_SCOPES.map((scope) => (
                  <label
                    key={scope}
                    className="flex items-center gap-1.5 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={selectedScopes.includes(scope)}
                      onChange={() =>
                        setSelectedScopes((prev) =>
                          prev.includes(scope)
                            ? prev.filter((s) => s !== scope)
                            : [...prev, scope]
                        )
                      }
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-gray-700 capitalize dark:text-zinc-300">
                      {scope}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={createFetcher.state !== 'idle'}
                className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-60"
              >
                {createFetcher.state !== 'idle' ? 'Creating…' : 'Create'}
              </button>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="text-sm text-gray-500 hover:text-gray-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                Cancel
              </button>
            </div>
          </createFetcher.Form>
        </div>
      )}

      <div className="overflow-hidden rounded-lg ring-1 ring-gray-200 dark:ring-zinc-700">
        <table className="min-w-full divide-y divide-gray-100 dark:divide-zinc-800">
          <thead className="bg-gray-50 dark:bg-zinc-800">
            <tr>
              {['Label', 'Scopes', 'Last used', 'Created', ''].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-zinc-400"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white dark:divide-zinc-800 dark:bg-zinc-900">
            {data.apiKeys.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-sm text-gray-400 dark:text-zinc-500"
                >
                  No API keys yet.
                </td>
              </tr>
            )}
            {data.apiKeys.map((key) => (
              <tr
                key={key.id}
                className="hover:bg-gray-50 dark:hover:bg-zinc-800/50"
              >
                <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                  {key.label}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {key.scopes.map((s) => (
                      <span
                        key={s}
                        className="inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-500 dark:text-zinc-400">
                  {key.lastUsedAt
                    ? new Date(key.lastUsedAt).toLocaleDateString()
                    : 'Never'}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500 dark:text-zinc-400">
                  {new Date(key.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <revokeFetcher.Form method="post">
                    <input type="hidden" name="intent" value="revoke-api-key" />
                    <input type="hidden" name="id" value={key.id} />
                    <button
                      type="submit"
                      disabled={revokeFetcher.state !== 'idle'}
                      onClick={(e) => {
                        if (
                          !confirm(
                            `Revoke "${key.label}"? This cannot be undone.`
                          )
                        ) {
                          e.preventDefault();
                        }
                      }}
                      className="rounded p-1 text-gray-400 hover:text-red-500 disabled:opacity-50 dark:hover:text-red-400"
                      title="Revoke key"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </revokeFetcher.Form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Webhook subscriptions section
// ---------------------------------------------------------------------------

function WebhooksSection({ data }) {
  const [showCreate, setShowCreate] = useState(false);
  const [selectedEvents, setSelectedEvents] = useState([]);
  const createFetcher = useFetcher();
  const deleteFetcher = useFetcher();

  const createError =
    createFetcher.state === 'idle' &&
    createFetcher.data &&
    !createFetcher.data.ok &&
    createFetcher.data?.intent === 'create-webhook'
      ? createFetcher.data.error
      : null;

  const justCreated =
    createFetcher.state === 'idle' &&
    createFetcher.data?.ok &&
    createFetcher.data?.intent === 'create-webhook';

  return (
    <SectionCard
      title="Outbound Webhooks"
      description="Receive real-time domain events as signed HTTP POSTs. Deliveries are retried on failure with exponential back-off."
    >
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
        >
          <PlusIcon className="h-4 w-4" />
          Add endpoint
        </button>
      </div>

      {showCreate && (
        <div className="mb-6 rounded-lg border border-indigo-100 bg-indigo-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/60">
          <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
            New webhook endpoint
          </h3>

          {justCreated && (
            <div className="mb-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">
              Webhook subscription created.
            </div>
          )}
          {createError && (
            <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
              {createError}
            </div>
          )}

          <createFetcher.Form method="post" className="space-y-3">
            <input type="hidden" name="intent" value="create-webhook" />
            {selectedEvents.map((e) => (
              <input key={e} type="hidden" name="events" value={e} />
            ))}

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-zinc-400">
                URL
              </label>
              <input
                type="url"
                name="url"
                placeholder="https://example.com/webhook"
                required
                className={inputClass()}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-zinc-400">
                Signing secret
              </label>
              <input
                type="text"
                name="secret"
                placeholder="whsec_..."
                required
                className={inputClass()}
              />
              <p className="mt-1 text-xs text-gray-400 dark:text-zinc-500">
                Used to compute HMAC-SHA256 signatures in the{' '}
                <code>X-Bermooda-Signature</code> header.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-zinc-400">
                Label (optional)
              </label>
              <input
                type="text"
                name="label"
                placeholder="My endpoint"
                className={inputClass()}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-zinc-400">
                Events
              </label>
              <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
                {data.supportedEvents.map((ev) => (
                  <label key={ev} className="flex items-center gap-1.5 text-xs">
                    <input
                      type="checkbox"
                      checked={selectedEvents.includes(ev)}
                      onChange={() =>
                        setSelectedEvents((prev) =>
                          prev.includes(ev)
                            ? prev.filter((e) => e !== ev)
                            : [...prev, ev]
                        )
                      }
                      className="h-3.5 w-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="font-mono text-gray-700 dark:text-zinc-300">
                      {ev}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={createFetcher.state !== 'idle'}
                className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-60"
              >
                {createFetcher.state !== 'idle'
                  ? 'Creating…'
                  : 'Create endpoint'}
              </button>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="text-sm text-gray-500 hover:text-gray-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                Cancel
              </button>
            </div>
          </createFetcher.Form>
        </div>
      )}

      <div className="overflow-hidden rounded-lg ring-1 ring-gray-200 dark:ring-zinc-700">
        <table className="min-w-full divide-y divide-gray-100 dark:divide-zinc-800">
          <thead className="bg-gray-50 dark:bg-zinc-800">
            <tr>
              {['URL', 'Events', 'Status', 'Created', ''].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-zinc-400"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white dark:divide-zinc-800 dark:bg-zinc-900">
            {data.subscriptions.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-sm text-gray-400 dark:text-zinc-500"
                >
                  No webhook endpoints configured.
                </td>
              </tr>
            )}
            {data.subscriptions.map((sub) => (
              <tr
                key={sub.id}
                className="hover:bg-gray-50 dark:hover:bg-zinc-800/50"
              >
                <td className="max-w-xs px-4 py-3 text-sm text-gray-900 dark:text-white">
                  <span className="block truncate font-mono" title={sub.url}>
                    {sub.url}
                  </span>
                  {sub.label && (
                    <span className="text-xs text-gray-400 dark:text-zinc-500">
                      {sub.label}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {sub.events.map((ev) => (
                      <span
                        key={ev}
                        className="inline-flex rounded-full bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-700 dark:bg-zinc-700 dark:text-zinc-300"
                      >
                        {ev}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={clsx(
                      'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                      sub.active
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-gray-100 text-gray-500 dark:bg-zinc-700 dark:text-zinc-400'
                    )}
                  >
                    {sub.active ? 'Active' : 'Paused'}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-500 dark:text-zinc-400">
                  {new Date(sub.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <deleteFetcher.Form method="post">
                    <input type="hidden" name="intent" value="delete-webhook" />
                    <input type="hidden" name="id" value={sub.id} />
                    <button
                      type="submit"
                      disabled={deleteFetcher.state !== 'idle'}
                      onClick={(e) => {
                        if (!confirm(`Delete webhook for "${sub.url}"?`))
                          e.preventDefault();
                      }}
                      className="rounded p-1 text-gray-400 hover:text-red-500 disabled:opacity-50 dark:hover:text-red-400"
                      title="Delete"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </deleteFetcher.Form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-800/40">
        <p className="text-xs text-gray-500 dark:text-zinc-400">
          <strong className="font-semibold text-gray-700 dark:text-zinc-300">
            Signature verification:
          </strong>{' '}
          Each POST carries an{' '}
          <code className="font-mono">
            X-Bermooda-Signature: sha256=&lt;hex&gt;
          </code>{' '}
          header. Compute HMAC-SHA256 of the raw body using your signing secret
          and compare to verify. Retries follow exponential back-off (30 s → 2
          min → 10 min → 30 min → 2 h).
        </p>
      </div>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const TABS = ['API Keys', 'Webhooks'];

export default function AdminApiSettingsRoute() {
  const data = useLoaderData();
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          API Settings
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Manage API keys and outbound webhook endpoints. Base URL:{' '}
          <code className="font-mono text-xs">/api/admin/v1</code>
        </p>
      </div>

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

      {activeTab === 0 && <ApiKeysSection data={data} />}
      {activeTab === 1 && <WebhooksSection data={data} />}
    </div>
  );
}
