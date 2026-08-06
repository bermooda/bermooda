// app/routes/admin/api-settings.jsx
// Admin UI for managing API keys and outbound webhook subscriptions.

import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { Link, useFetcher, useLoaderData } from 'react-router';

import { authenticate } from '#/libs/auth/admin/index.server';
import { revokeApiKey, listApiKeys } from '#/core/api-keys/index.server';
import { recordAdminAudit } from '#/core/audit/index.server';
import { DOMAIN_EVENTS } from '#/core/events/names';
import { useT } from '#/core/i18n';
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

/**
 * @param {Object} props
 * @param {string} props.title
 * @param {string} [props.description]
 * @param {React.ReactNode} props.children
 */
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

/**
 * @param {{ data: { apiKeys: object[] } }} props
 */
function ApiKeysSection({ data }) {
  const t = useT();
  const revokeFetcher = useFetcher();

  return (
    <SectionCard
      title={t('admin.apiSettings.index.keysTitle')}
      description={t('admin.apiSettings.index.keysDescription')}
    >
      <div className="mb-4 flex justify-end">
        <Link
          to="/admin/api-settings/keys/new"
          className="bg-accent text-accent-fg hover:bg-accent-hover focus-visible:outline-accent inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-semibold shadow-sm transition focus-visible:outline focus-visible:outline-offset-2"
        >
          <PlusIcon className="h-4 w-4" />
          {t('admin.apiSettings.index.createKey')}
        </Link>
      </div>

      <Table>
        <THead>
          <tr>
            <Th>{t('admin.apiSettings.index.col.label')}</Th>
            <Th>{t('admin.apiSettings.index.col.scopes')}</Th>
            <Th>{t('admin.apiSettings.index.col.lastUsed')}</Th>
            <Th>{t('admin.apiSettings.index.col.created')}</Th>
            <Th />
          </tr>
        </THead>
        <TBody>
          {data.apiKeys.length === 0 && (
            <tr>
              <Td colSpan={5} className="py-8 text-center">
                {t('admin.apiSettings.index.noKeys')}
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
                  : t('admin.apiSettings.index.never')}
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
                          t('admin.apiSettings.index.revokeConfirm', {
                            label: key.label,
                          })
                        )
                      ) {
                        e.preventDefault();
                      }
                    }}
                    className="text-text-muted hover:text-danger rounded p-1 disabled:opacity-50"
                    title={t('admin.apiSettings.index.revokeTitle')}
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

/**
 * @param {{ data: { subscriptions: object[] } }} props
 */
function WebhooksSection({ data }) {
  const t = useT();
  const deleteFetcher = useFetcher();
  const toggleFetcher = useFetcher();

  return (
    <SectionCard
      title={t('admin.apiSettings.index.webhooksTitle')}
      description={t('admin.apiSettings.index.webhooksDescription')}
    >
      <div className="mb-4 flex justify-end">
        <Link
          to="/admin/api-settings/webhooks/new"
          className="bg-accent text-accent-fg hover:bg-accent-hover focus-visible:outline-accent inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-semibold shadow-sm transition focus-visible:outline focus-visible:outline-offset-2"
        >
          <PlusIcon className="h-4 w-4" />
          {t('admin.apiSettings.index.addEndpoint')}
        </Link>
      </div>

      <Table>
        <THead>
          <tr>
            <Th>{t('admin.apiSettings.index.col.url')}</Th>
            <Th>{t('admin.apiSettings.index.col.events')}</Th>
            <Th>{t('admin.apiSettings.index.col.status')}</Th>
            <Th>{t('admin.apiSettings.index.col.created')}</Th>
            <Th />
          </tr>
        </THead>
        <TBody>
          {data.subscriptions.length === 0 && (
            <tr>
              <Td colSpan={5} className="py-8 text-center">
                {t('admin.apiSettings.index.noWebhooks')}
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
                    title={
                      sub.active
                        ? t('admin.apiSettings.index.pauseWebhook')
                        : t('admin.apiSettings.index.activateWebhook')
                    }
                  >
                    <Badge tone={sub.active ? 'success' : 'neutral'}>
                      {sub.active
                        ? t('admin.apiSettings.index.statusActive')
                        : t('admin.apiSettings.index.statusPaused')}
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
                      if (
                        !confirm(
                          t('admin.apiSettings.index.deleteConfirm', {
                            url: sub.url,
                          })
                        )
                      )
                        e.preventDefault();
                    }}
                    className="text-text-muted hover:text-danger rounded p-1 disabled:opacity-50"
                    title={t('admin.apiSettings.index.deleteTitle')}
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
            {t('admin.apiSettings.index.signatureVerification')}
          </strong>{' '}
          {t('admin.apiSettings.index.signatureHelp')}
        </p>
      </div>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * @returns {React.ReactElement}
 */
export default function AdminApiSettingsRoute() {
  const t = useT();
  const data = useLoaderData();
  const [activeTab, setActiveTab] = useState(0);
  const tabs = [
    t('admin.apiSettings.index.tab.keys'),
    t('admin.apiSettings.index.tab.webhooks'),
  ];

  return (
    <div>
      <PageHeader
        title={t('admin.apiSettings.index.title')}
        subtitle={
          <>
            {t('admin.apiSettings.index.subtitle')}{' '}
            <code className="font-mono text-xs">/api/admin/v1</code>
          </>
        }
      />

      <Tabs
        tabs={tabs}
        active={activeTab}
        onChange={setActiveTab}
        className="mb-6"
      />

      {activeTab === 0 && <ApiKeysSection data={data} />}
      {activeTab === 1 && <WebhooksSection data={data} />}
    </div>
  );
}
