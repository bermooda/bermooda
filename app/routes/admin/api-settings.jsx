// app/routes/admin/api-settings.jsx
// Admin UI for managing API keys and outbound webhook subscriptions.

import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { Link, useFetcher, useLoaderData } from 'react-router';

import { authenticate } from '#/libs/auth/admin/index.server';
import { revokeApiKey, listApiKeys } from '#/core/api-keys/index.server';
import { recordAdminAudit } from '#/core/audit/index.server';
import { DOMAIN_EVENTS } from '#/core/events/names';
import {
  deleteSubscription,
  listSubscriptions,
  updateSubscription,
} from '#/core/webhooks/index.server';
import Badge from '#/components/admin/badge';
import Card from '#/components/admin/card';
import PageHeader from '#/components/admin/page-header';
import Table, { TBody, Td, Th, THead } from '#/components/admin/table';
import Tabs from '#/components/admin/tabs';

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export async function loader({ request }) {
  await authenticate(request);
  const [{ apiKeys }, { subscriptions }] = await Promise.all([
    listApiKeys({ page: 1, limit: 100 }),
    listSubscriptions(),
  ]);
  return { apiKeys, subscriptions, supportedEvents: DOMAIN_EVENTS };
}

// ---------------------------------------------------------------------------
// Action
// ---------------------------------------------------------------------------

export async function action({ request }) {
  const { user } = await authenticate(request);
  const formData = await request.formData();
  const intent = formData.get('intent');

  // ── Revoke API key ─────────────────────────────────────────────────────────
  if (intent === 'revoke-api-key') {
    const id = formData.get('id')?.toString();
    if (!id) return { ok: false, intent, error: 'Missing id' };
    try {
      await revokeApiKey(id);
      await recordAdminAudit({
        user,
        action: 'api_key.revoked',
        entityType: 'api_key',
        entityId: id,
      });
      return { ok: true, intent };
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
      await recordAdminAudit({
        user,
        action: 'webhook.deleted',
        entityType: 'webhook_subscription',
        entityId: id,
      });
      return { ok: true, intent };
    } catch (err) {
      return { ok: false, intent, error: err.message };
    }
  }

  // ── Toggle webhook active ──────────────────────────────────────────────────
  if (intent === 'toggle-webhook') {
    const id = formData.get('id')?.toString();
    const active = formData.get('active') === 'true';
    if (!id) return { ok: false, intent, error: 'Missing id' };
    try {
      await updateSubscription(id, { active: !active });
      await recordAdminAudit({
        user,
        action: 'webhook.updated',
        entityType: 'webhook_subscription',
        entityId: id,
        metadata: { active: !active },
      });
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

function ApiKeysSection({ data }) {
  const revokeFetcher = useFetcher();

  return (
    <SectionCard
      title="API Keys"
      description="API keys authenticate requests to /api/admin/v1/* endpoints. Store keys securely — they are shown only once."
    >
      <div className="mb-4 flex justify-end">
        <Link
          to="/admin/api-settings/keys/new"
          className="bg-accent text-accent-fg hover:bg-accent-hover focus-visible:outline-accent inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-semibold shadow-sm transition focus-visible:outline focus-visible:outline-offset-2"
        >
          <PlusIcon className="h-4 w-4" />
          Create key
        </Link>
      </div>

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
  const deleteFetcher = useFetcher();
  const toggleFetcher = useFetcher();

  return (
    <SectionCard
      title="Outbound Webhooks"
      description="Receive real-time domain events as signed HTTP POSTs. Deliveries are retried on failure with exponential back-off."
    >
      <div className="mb-4 flex justify-end">
        <Link
          to="/admin/api-settings/webhooks/new"
          className="bg-accent text-accent-fg hover:bg-accent-hover focus-visible:outline-accent inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-semibold shadow-sm transition focus-visible:outline focus-visible:outline-offset-2"
        >
          <PlusIcon className="h-4 w-4" />
          Add endpoint
        </Link>
      </div>

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
                <toggleFetcher.Form method="post">
                  <input type="hidden" name="intent" value="toggle-webhook" />
                  <input type="hidden" name="id" value={sub.id} />
                  <input
                    type="hidden"
                    name="active"
                    value={String(sub.active)}
                  />
                  <button
                    type="submit"
                    disabled={toggleFetcher.state !== 'idle'}
                    className="disabled:opacity-50"
                    title={sub.active ? 'Pause webhook' : 'Activate webhook'}
                  >
                    <Badge tone={sub.active ? 'success' : 'neutral'}>
                      {sub.active ? 'Active' : 'Paused'}
                    </Badge>
                  </button>
                </toggleFetcher.Form>
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
