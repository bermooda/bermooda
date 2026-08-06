// app/routes/admin/api-settings.jsx
// Admin UI for managing API keys and outbound webhook subscriptions.

import {
  KeyIcon,
  PlusIcon,
  TrashIcon,
  BoltIcon,
} from '@heroicons/react/24/outline';
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
import EmptyState from '#/components/admin/empty-state';
import PageHeader from '#/components/admin/page-header';
import Table, { TBody, Td, Th, THead, Tr } from '#/components/admin/table';
import Tabs from '#/components/admin/tabs';
import Toolbar, { ToolbarGroup } from '#/components/admin/toolbar';

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
// Helpers
// ---------------------------------------------------------------------------

/**
 * @param {string} iso
 * @returns {string}
 */
function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
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
  const count = data.apiKeys.length;

  return (
    <div>
      <p className="text-text-muted mb-4 text-sm">
        {t('admin.apiSettings.index.keysDescription')}
      </p>

      <Toolbar className="border-border mb-4 rounded-xl border shadow-xs sm:px-4">
        <ToolbarGroup>
          <span className="text-text-muted text-sm">
            {count === 1
              ? t('admin.apiSettings.index.keysResultsOne', { count })
              : t('admin.apiSettings.index.keysResults', { count })}
          </span>
        </ToolbarGroup>
        <ToolbarGroup>
          <Link
            to="/admin/api-settings/keys/new"
            className="bg-accent text-accent-fg hover:bg-accent-hover focus-visible:outline-accent inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-semibold shadow-sm transition focus-visible:outline focus-visible:outline-offset-2"
          >
            <PlusIcon className="h-4 w-4" />
            {t('admin.apiSettings.index.createKey')}
          </Link>
        </ToolbarGroup>
      </Toolbar>

      {count === 0 ? (
        <EmptyState
          icon={KeyIcon}
          title={t('admin.apiSettings.index.emptyKeysTitle')}
          description={t('admin.apiSettings.index.emptyKeysDescription')}
          action={
            <Link
              to="/admin/api-settings/keys/new"
              className="bg-accent text-accent-fg hover:bg-accent-hover inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold shadow-sm transition"
            >
              <PlusIcon className="h-4 w-4" />
              {t('admin.apiSettings.index.createKey')}
            </Link>
          }
        />
      ) : (
        <Table variant="sticky" className="mt-2">
          <THead sticky>
            <tr>
              <Th sticky className="py-3.5 pr-3 pl-1 sm:pl-0">
                {t('admin.apiSettings.index.col.label')}
              </Th>
              <Th sticky className="hidden px-3 py-3.5 sm:table-cell">
                {t('admin.apiSettings.index.col.scopes')}
              </Th>
              <Th sticky className="hidden px-3 py-3.5 md:table-cell">
                {t('admin.apiSettings.index.col.lastUsed')}
              </Th>
              <Th sticky className="hidden px-3 py-3.5 lg:table-cell">
                {t('admin.apiSettings.index.col.created')}
              </Th>
              <Th sticky className="py-3.5 pr-1 pl-3 sm:pr-0">
                <span className="sr-only">
                  {t('admin.apiSettings.index.revokeTitle')}
                </span>
              </Th>
            </tr>
          </THead>
          <TBody sticky>
            {data.apiKeys.map((key) => (
              <Tr key={key.id}>
                <Td
                  sticky
                  className="text-text py-4 pr-3 pl-1 font-medium whitespace-normal sm:pl-0"
                >
                  <span className="block min-w-0">
                    <span className="block truncate font-medium">
                      {key.label}
                    </span>
                    <span className="text-text-muted mt-0.5 block truncate font-mono text-xs font-normal">
                      {key.id.slice(0, 8)}
                    </span>
                    <span className="mt-1 flex flex-wrap gap-1 sm:hidden">
                      {key.scopes.map((s) => (
                        <Badge key={s} tone="accent">
                          {s}
                        </Badge>
                      ))}
                    </span>
                  </span>
                </Td>
                <Td
                  sticky
                  className="hidden px-3 py-4 whitespace-normal sm:table-cell"
                >
                  <div className="flex max-w-xs flex-wrap gap-1">
                    {key.scopes.length === 0 ? (
                      <span className="text-text-muted text-xs">—</span>
                    ) : (
                      key.scopes.map((s) => (
                        <Badge key={s} tone="accent">
                          {s}
                        </Badge>
                      ))
                    )}
                  </div>
                </Td>
                <Td
                  sticky
                  className="hidden px-3 py-4 tabular-nums md:table-cell"
                >
                  {key.lastUsedAt
                    ? formatDate(key.lastUsedAt)
                    : t('admin.apiSettings.index.never')}
                </Td>
                <Td
                  sticky
                  className="hidden px-3 py-4 tabular-nums lg:table-cell"
                >
                  {formatDate(key.createdAt)}
                </Td>
                <Td
                  sticky
                  className="py-4 pr-1 pl-3 text-right text-sm font-medium sm:pr-0"
                >
                  <revokeFetcher.Form method="post" className="inline">
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
                      className="text-danger hover:text-danger/80 inline-flex items-center gap-1 disabled:opacity-50"
                      title={t('admin.apiSettings.index.revokeTitle')}
                    >
                      <TrashIcon className="h-4 w-4" />
                      <span className="sr-only">
                        {t('admin.apiSettings.index.revokeTitle')}, {key.label}
                      </span>
                    </button>
                  </revokeFetcher.Form>
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      )}
    </div>
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
  const count = data.subscriptions.length;

  return (
    <div>
      <p className="text-text-muted mb-4 text-sm">
        {t('admin.apiSettings.index.webhooksDescription')}
      </p>

      <Toolbar className="border-border mb-4 rounded-xl border shadow-xs sm:px-4">
        <ToolbarGroup>
          <span className="text-text-muted text-sm">
            {count === 1
              ? t('admin.apiSettings.index.webhooksResultsOne', { count })
              : t('admin.apiSettings.index.webhooksResults', { count })}
          </span>
        </ToolbarGroup>
        <ToolbarGroup>
          <Link
            to="/admin/api-settings/webhooks/new"
            className="bg-accent text-accent-fg hover:bg-accent-hover focus-visible:outline-accent inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-semibold shadow-sm transition focus-visible:outline focus-visible:outline-offset-2"
          >
            <PlusIcon className="h-4 w-4" />
            {t('admin.apiSettings.index.addEndpoint')}
          </Link>
        </ToolbarGroup>
      </Toolbar>

      {count === 0 ? (
        <EmptyState
          icon={BoltIcon}
          title={t('admin.apiSettings.index.emptyWebhooksTitle')}
          description={t('admin.apiSettings.index.emptyWebhooksDescription')}
          action={
            <Link
              to="/admin/api-settings/webhooks/new"
              className="bg-accent text-accent-fg hover:bg-accent-hover inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold shadow-sm transition"
            >
              <PlusIcon className="h-4 w-4" />
              {t('admin.apiSettings.index.addEndpoint')}
            </Link>
          }
        />
      ) : (
        <Table variant="sticky" className="mt-2">
          <THead sticky>
            <tr>
              <Th sticky className="py-3.5 pr-3 pl-1 sm:pl-0">
                {t('admin.apiSettings.index.col.url')}
              </Th>
              <Th sticky className="hidden px-3 py-3.5 lg:table-cell">
                {t('admin.apiSettings.index.col.events')}
              </Th>
              <Th sticky className="px-3 py-3.5">
                {t('admin.apiSettings.index.col.status')}
              </Th>
              <Th sticky className="hidden px-3 py-3.5 md:table-cell">
                {t('admin.apiSettings.index.col.created')}
              </Th>
              <Th sticky className="py-3.5 pr-1 pl-3 sm:pr-0">
                <span className="sr-only">
                  {t('admin.apiSettings.index.deleteTitle')}
                </span>
              </Th>
            </tr>
          </THead>
          <TBody sticky>
            {data.subscriptions.map((sub) => {
              const primaryLabel = sub.label || sub.url;
              return (
                <Tr key={sub.id}>
                  <Td
                    sticky
                    className="text-text py-4 pr-3 pl-1 font-medium whitespace-normal sm:pl-0"
                  >
                    <span className="block min-w-0">
                      <span className="block truncate font-medium">
                        {primaryLabel}
                      </span>
                      {sub.label ? (
                        <span
                          className="text-text-muted mt-0.5 block truncate font-mono text-xs font-normal"
                          title={sub.url}
                        >
                          {sub.url}
                        </span>
                      ) : (
                        <span className="text-text-muted mt-0.5 block truncate font-mono text-xs font-normal">
                          {sub.id.slice(0, 8)}
                        </span>
                      )}
                      <span className="mt-1 flex flex-wrap gap-1 lg:hidden">
                        {sub.events.map((ev) => (
                          <Badge key={ev} className="font-mono">
                            {ev}
                          </Badge>
                        ))}
                      </span>
                    </span>
                  </Td>
                  <Td
                    sticky
                    className="hidden px-3 py-4 whitespace-normal lg:table-cell"
                  >
                    <div className="flex max-w-xs flex-wrap gap-1">
                      {sub.events.length === 0 ? (
                        <span className="text-text-muted text-xs">—</span>
                      ) : (
                        sub.events.map((ev) => (
                          <Badge key={ev} className="font-mono">
                            {ev}
                          </Badge>
                        ))
                      )}
                    </div>
                  </Td>
                  <Td sticky className="px-3 py-4">
                    <toggleFetcher.Form method="post">
                      <input
                        type="hidden"
                        name="intent"
                        value="toggle-webhook"
                      />
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
                  <Td
                    sticky
                    className="hidden px-3 py-4 tabular-nums md:table-cell"
                  >
                    {formatDate(sub.createdAt)}
                  </Td>
                  <Td
                    sticky
                    className="py-4 pr-1 pl-3 text-right text-sm font-medium sm:pr-0"
                  >
                    <deleteFetcher.Form method="post" className="inline">
                      <input
                        type="hidden"
                        name="intent"
                        value="delete-webhook"
                      />
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
                        className="text-danger hover:text-danger/80 inline-flex items-center gap-1 disabled:opacity-50"
                        title={t('admin.apiSettings.index.deleteTitle')}
                      >
                        <TrashIcon className="h-4 w-4" />
                        <span className="sr-only">
                          {t('admin.apiSettings.index.deleteTitle')}, {sub.url}
                        </span>
                      </button>
                    </deleteFetcher.Form>
                  </Td>
                </Tr>
              );
            })}
          </TBody>
        </Table>
      )}

      <div className="border-border bg-surface mt-6 rounded-xl border px-4 py-3">
        <p className="text-text-muted text-xs">
          <strong className="text-text font-semibold">
            {t('admin.apiSettings.index.signatureVerification')}
          </strong>{' '}
          {t('admin.apiSettings.index.signatureHelp')}
        </p>
      </div>
    </div>
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
