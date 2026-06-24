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
import Badge from '#/components/admin/badge';
import Card from '#/components/admin/card';
import { controlClasses } from '#/components/admin/form/input';
import PageHeader from '#/components/admin/page-header';
import Table, { TBody, Td, Th, THead } from '#/components/admin/table';
import Tabs from '#/components/admin/tabs';
import Button from '#/components/ui/button';

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

const CHECKBOX_CLASS =
  'border-border text-accent focus:ring-accent bg-surface h-4 w-4 rounded';

function inputClass(extra) {
  return clsx(controlClasses, extra);
}

function SectionCard({ title, description, children }) {
  return (
    <Card padded={false}>
      <div className="border-border border-b px-4 py-4 sm:px-6">
        <h2 className="text-text text-base font-semibold">{title}</h2>
        {description && (
          <p className="text-text-muted mt-0.5 text-sm">{description}</p>
        )}
      </div>
      <div className="p-4 sm:p-6">{children}</div>
    </Card>
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
      className="text-text-muted hover:text-accent ml-2 rounded p-1"
      title="Copy to clipboard"
    >
      {copied ? (
        <CheckIcon className="text-success h-4 w-4" />
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
        <Button type="button" onClick={() => setShowCreate((v) => !v)}>
          <PlusIcon className="mr-1.5 h-4 w-4" />
          Create key
        </Button>
      </div>

      {showCreate && (
        <div className="border-border bg-surface-2 mb-6 rounded-lg border p-4">
          <h3 className="text-text mb-3 text-sm font-semibold">New API key</h3>

          {justCreated && createFetcher.data?.key && (
            <div className="bg-success/10 mb-4 rounded-md p-3">
              <p className="text-success mb-1 text-sm font-semibold">
                Key created — copy it now, it won't be shown again:
              </p>
              <div className="text-success flex items-center font-mono text-sm">
                <code className="break-all">{createFetcher.data.key}</code>
                <CopyButton value={createFetcher.data.key} />
              </div>
            </div>
          )}

          {createError && (
            <div className="bg-danger/10 text-danger mb-3 rounded-md px-3 py-2 text-sm">
              {createError}
            </div>
          )}

          <createFetcher.Form method="post" className="max-w-sm space-y-3">
            <input type="hidden" name="intent" value="create-api-key" />
            {selectedScopes.map((s) => (
              <input key={s} type="hidden" name="scopes" value={s} />
            ))}

            <div>
              <label className="text-text-muted mb-1 block text-xs font-medium">
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
              <label className="text-text-muted mb-1 block text-xs font-medium">
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
                      className={CHECKBOX_CLASS}
                    />
                    <span className="text-text capitalize">{scope}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={createFetcher.state !== 'idle'}>
                {createFetcher.state !== 'idle' ? 'Creating…' : 'Create'}
              </Button>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="text-text-muted hover:text-text text-sm"
              >
                Cancel
              </button>
            </div>
          </createFetcher.Form>
        </div>
      )}

      <Table>
        <THead>
          <tr>
            {['Label', 'Scopes', 'Last used', 'Created', ''].map((h, i) => (
              <Th key={h || `col-${i}`}>{h}</Th>
            ))}
          </tr>
        </THead>
        <TBody>
          {data.apiKeys.length === 0 && (
            <tr>
              <Td colSpan={5} className="py-8 text-center">
                No API keys yet.
              </Td>
            </tr>
          )}
          {data.apiKeys.map((key) => (
            <tr key={key.id}>
              <Td className="text-text font-medium">{key.label}</Td>
              <Td>
                <div className="flex flex-wrap gap-1">
                  {key.scopes.map((s) => (
                    <Badge key={s} tone="accent">
                      {s}
                    </Badge>
                  ))}
                </div>
              </Td>
              <Td>
                {key.lastUsedAt
                  ? new Date(key.lastUsedAt).toLocaleDateString()
                  : 'Never'}
              </Td>
              <Td>{new Date(key.createdAt).toLocaleDateString()}</Td>
              <Td>
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
                    className="text-text-muted hover:text-danger rounded p-1 disabled:opacity-50"
                    title="Revoke key"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </revokeFetcher.Form>
              </Td>
            </tr>
          ))}
        </TBody>
      </Table>
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
        <Button type="button" onClick={() => setShowCreate((v) => !v)}>
          <PlusIcon className="mr-1.5 h-4 w-4" />
          Add endpoint
        </Button>
      </div>

      {showCreate && (
        <div className="border-border bg-surface-2 mb-6 rounded-lg border p-4">
          <h3 className="text-text mb-3 text-sm font-semibold">
            New webhook endpoint
          </h3>

          {justCreated && (
            <div className="bg-success/10 text-success mb-3 rounded-md px-3 py-2 text-sm">
              Webhook subscription created.
            </div>
          )}
          {createError && (
            <div className="bg-danger/10 text-danger mb-3 rounded-md px-3 py-2 text-sm">
              {createError}
            </div>
          )}

          <createFetcher.Form method="post" className="space-y-3">
            <input type="hidden" name="intent" value="create-webhook" />
            {selectedEvents.map((e) => (
              <input key={e} type="hidden" name="events" value={e} />
            ))}

            <div>
              <label className="text-text-muted mb-1 block text-xs font-medium">
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
              <label className="text-text-muted mb-1 block text-xs font-medium">
                Signing secret
              </label>
              <input
                type="text"
                name="secret"
                placeholder="whsec_..."
                required
                className={inputClass()}
              />
              <p className="text-text-muted mt-1 text-xs">
                Used to compute HMAC-SHA256 signatures in the{' '}
                <code>X-Bermooda-Signature</code> header.
              </p>
            </div>

            <div>
              <label className="text-text-muted mb-1 block text-xs font-medium">
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
              <label className="text-text-muted mb-1 block text-xs font-medium">
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
                      className={clsx(CHECKBOX_CLASS, 'h-3.5 w-3.5')}
                    />
                    <span className="text-text font-mono">{ev}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={createFetcher.state !== 'idle'}>
                {createFetcher.state !== 'idle'
                  ? 'Creating…'
                  : 'Create endpoint'}
              </Button>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="text-text-muted hover:text-text text-sm"
              >
                Cancel
              </button>
            </div>
          </createFetcher.Form>
        </div>
      )}

      <Table>
        <THead>
          <tr>
            {['URL', 'Events', 'Status', 'Created', ''].map((h, i) => (
              <Th key={h || `col-${i}`}>{h}</Th>
            ))}
          </tr>
        </THead>
        <TBody>
          {data.subscriptions.length === 0 && (
            <tr>
              <Td colSpan={5} className="py-8 text-center">
                No webhook endpoints configured.
              </Td>
            </tr>
          )}
          {data.subscriptions.map((sub) => (
            <tr key={sub.id}>
              <Td className="text-text max-w-xs">
                <span className="block truncate font-mono" title={sub.url}>
                  {sub.url}
                </span>
                {sub.label && (
                  <span className="text-text-muted text-xs">{sub.label}</span>
                )}
              </Td>
              <Td>
                <div className="flex flex-wrap gap-1">
                  {sub.events.map((ev) => (
                    <Badge key={ev} className="font-mono">
                      {ev}
                    </Badge>
                  ))}
                </div>
              </Td>
              <Td>
                <Badge tone={sub.active ? 'success' : 'neutral'}>
                  {sub.active ? 'Active' : 'Paused'}
                </Badge>
              </Td>
              <Td>{new Date(sub.createdAt).toLocaleDateString()}</Td>
              <Td>
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
                    className="text-text-muted hover:text-danger rounded p-1 disabled:opacity-50"
                    title="Delete"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </deleteFetcher.Form>
              </Td>
            </tr>
          ))}
        </TBody>
      </Table>

      <div className="border-border bg-surface-2 mt-4 rounded-lg border px-4 py-3">
        <p className="text-text-muted text-xs">
          <strong className="text-text font-semibold">
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
      <PageHeader
        title="API Settings"
        subtitle={
          <>
            Manage API keys and outbound webhook endpoints. Base URL:{' '}
            <code className="font-mono text-xs">/api/admin/v1</code>
          </>
        }
        className="mb-6"
      />

      <Tabs
        tabs={TABS}
        active={activeTab}
        onChange={setActiveTab}
        className="mb-6"
      />

      {activeTab === 0 && <ApiKeysSection data={data} />}
      {activeTab === 1 && <WebhooksSection data={data} />}
    </div>
  );
}
