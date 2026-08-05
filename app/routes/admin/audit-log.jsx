// app/routes/admin/audit-log.jsx
// Paginated admin audit log viewer — sticky table with toolbar filters.

import { ClipboardDocumentListIcon } from '@heroicons/react/24/outline';
import { Form, useLoaderData, useSearchParams } from 'react-router';

import { authenticate } from '#/libs/auth/admin/index.server';
import { listAuditLogs, parseAuditListParams } from '#/core/audit/index.server';
import { useT } from '#/core/i18n';
import EmptyState from '#/components/admin/empty-state';
import Input from '#/components/admin/form/input';
import PageHeader from '#/components/admin/page-header';
import Pagination from '#/components/admin/pagination';
import Table, { TBody, Td, Th, THead, Tr } from '#/components/admin/table';
import Toolbar, { ToolbarGroup } from '#/components/admin/toolbar';
import Button from '#/components/ui/button';

export function meta() {
  return [
    { title: 'Audit Log — Admin' },
    {
      name: 'description',
      content: 'Admin mutation and system event audit trail',
    },
  ];
}

export async function loader({ request }) {
  await authenticate(request);
  const url = new URL(request.url);
  const params = parseAuditListParams(url.searchParams);
  const result = await listAuditLogs(params);

  return {
    ...result,
    actionFilter: params.action ?? '',
    entityTypeFilter: params.entityType ?? '',
  };
}

/**
 * @param {string | Date} value
 * @returns {string}
 */
function formatDateTime(value) {
  return new Date(value).toLocaleString('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * @returns {React.ReactElement}
 */
export default function AdminAuditLogRoute() {
  const t = useT();
  const { auditLogs, total, page, totalPages, actionFilter, entityTypeFilter } =
    useLoaderData();
  const [, setSearchParams] = useSearchParams();

  /**
   * @param {number} p
   */
  function goToPage(p) {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.set('page', String(p));
      return params;
    });
  }

  const hasFilter = Boolean(actionFilter) || Boolean(entityTypeFilter);

  return (
    <div>
      <PageHeader
        title={t('admin.auditLog.title')}
        subtitle={t('admin.auditLog.subtitle', {
          total: total.toLocaleString('en'),
        })}
      />

      <Toolbar className="border-border mb-4 rounded-xl border shadow-xs sm:px-4">
        <Form
          method="get"
          className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center"
        >
          <Input
            type="text"
            name="action"
            defaultValue={actionFilter}
            placeholder={t('admin.auditLog.filter.actionPlaceholder')}
            aria-label={t('admin.auditLog.filter.action')}
            className="w-full sm:max-w-xs"
          />
          <Input
            type="text"
            name="entityType"
            defaultValue={entityTypeFilter}
            placeholder={t('admin.auditLog.filter.entityTypePlaceholder')}
            aria-label={t('admin.auditLog.filter.entityType')}
            className="w-full sm:max-w-xs"
          />
          <Button type="submit" variant="secondary">
            {t('admin.auditLog.filter.submit')}
          </Button>
        </Form>
        <ToolbarGroup>
          <span className="text-text-muted text-sm">
            {total === 1
              ? t('admin.auditLog.resultsOne', { count: total })
              : t('admin.auditLog.results', { count: total })}
          </span>
        </ToolbarGroup>
      </Toolbar>

      {auditLogs.length === 0 ? (
        <EmptyState
          icon={ClipboardDocumentListIcon}
          title={t('admin.auditLog.emptyTitle')}
          description={
            hasFilter
              ? t('admin.auditLog.emptyDescriptionFilter')
              : t('admin.auditLog.emptyDescription')
          }
        />
      ) : (
        <Table variant="sticky" className="mt-2">
          <THead sticky>
            <tr>
              <Th sticky className="py-3.5 pr-3 pl-1 sm:pl-0">
                {t('admin.auditLog.col.when')}
              </Th>
              <Th sticky className="px-3 py-3.5">
                {t('admin.auditLog.col.actor')}
              </Th>
              <Th sticky className="px-3 py-3.5">
                {t('admin.auditLog.col.action')}
              </Th>
              <Th sticky className="hidden px-3 py-3.5 md:table-cell">
                {t('admin.auditLog.col.entity')}
              </Th>
              <Th sticky className="hidden px-3 py-3.5 lg:table-cell">
                {t('admin.auditLog.col.details')}
              </Th>
            </tr>
          </THead>
          <TBody sticky>
            {auditLogs.map((entry) => (
              <Tr key={entry.id}>
                <Td
                  sticky
                  className="text-text py-4 pr-3 pl-1 font-medium whitespace-normal sm:pl-0"
                >
                  <span className="block tabular-nums">
                    {formatDateTime(entry.createdAt)}
                  </span>
                </Td>
                <Td sticky className="px-3 py-4">
                  <span className="block min-w-0">
                    <span className="block truncate font-medium capitalize">
                      {entry.actorType}
                    </span>
                    {entry.actorEmail ? (
                      <span className="text-text-muted mt-0.5 block truncate text-xs font-normal">
                        {entry.actorEmail}
                      </span>
                    ) : null}
                  </span>
                </Td>
                <Td sticky className="px-3 py-4 font-mono text-sm">
                  {entry.action}
                </Td>
                <Td sticky className="hidden px-3 py-4 md:table-cell">
                  {entry.entityType ? (
                    <span className="block min-w-0">
                      <span className="block truncate">{entry.entityType}</span>
                      {entry.entityId ? (
                        <span className="text-text-muted mt-0.5 block truncate font-mono text-xs">
                          {entry.entityId}
                        </span>
                      ) : null}
                    </span>
                  ) : (
                    <span className="text-text-muted">—</span>
                  )}
                </Td>
                <Td
                  sticky
                  className="text-text-muted hidden max-w-xs truncate px-3 py-4 font-mono text-xs lg:table-cell"
                >
                  {entry.diff
                    ? JSON.stringify(entry.diff)
                    : entry.metadata
                      ? JSON.stringify(entry.metadata)
                      : '—'}
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      )}

      <Pagination page={page} totalPages={totalPages} onPageChange={goToPage} />
    </div>
  );
}
