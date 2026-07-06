// app/routes/admin/audit-log.jsx
// Paginated admin audit log viewer.

import { Form, useLoaderData, useSearchParams } from 'react-router';

import { authenticate } from '#/libs/auth/admin.server';
import {
  listAuditLogs,
  parseAuditListParams,
} from '#/core/audit/index.server';
import Card from '#/components/admin/card';
import Field from '#/components/admin/form/field';
import Input from '#/components/admin/form/input';
import PageHeader from '#/components/admin/page-header';
import Pagination from '#/components/admin/pagination';
import Table, { Th, Td, THead, TBody } from '#/components/admin/table';
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

  return result;
}

export default function AdminAuditLogRoute() {
  const { auditLogs, total, page, totalPages } = useLoaderData();
  const [searchParams, setSearchParams] = useSearchParams();

  function goToPage(p) {
    const params = new URLSearchParams(searchParams);
    params.set('page', String(p));
    setSearchParams(params);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Log"
        subtitle={`${total.toLocaleString('en')} entries — admin mutations and domain events.`}
      />

      <Card>
        <Form method="get" className="flex flex-wrap items-end gap-4">
          <Field label="Action">
            <Input
              type="text"
              name="action"
              defaultValue={searchParams.get('action') ?? ''}
              placeholder="e.g. order.created"
            />
          </Field>
          <Field label="Entity type">
            <Input
              type="text"
              name="entityType"
              defaultValue={searchParams.get('entityType') ?? ''}
              placeholder="e.g. order"
            />
          </Field>
          <Button type="submit" variant="primary">
            Filter
          </Button>
        </Form>
      </Card>

      <Table>
        <THead>
          <tr>
            {['When', 'Actor', 'Action', 'Entity', 'Details'].map((col) => (
              <Th key={col}>{col}</Th>
            ))}
          </tr>
        </THead>
        <TBody>
          {auditLogs.length === 0 ? (
            <tr>
              <Td colSpan={5} className="py-8 text-center">
                No audit entries yet.
              </Td>
            </tr>
          ) : (
            auditLogs.map((entry) => (
              <tr key={entry.id}>
                <Td>{new Date(entry.createdAt).toLocaleString('en')}</Td>
                <Td className="text-text">
                  <span className="font-medium capitalize">
                    {entry.actorType}
                  </span>
                  {entry.actorEmail && (
                    <span className="text-text-muted block text-xs">
                      {entry.actorEmail}
                    </span>
                  )}
                </Td>
                <Td className="text-text font-mono">{entry.action}</Td>
                <Td>
                  {entry.entityType && (
                    <span>
                      {entry.entityType}
                      {entry.entityId && (
                        <span className="text-text-muted block font-mono text-xs">
                          {entry.entityId}
                        </span>
                      )}
                    </span>
                  )}
                </Td>
                <Td className="max-w-xs truncate text-xs">
                  {entry.diff
                    ? JSON.stringify(entry.diff)
                    : entry.metadata
                      ? JSON.stringify(entry.metadata)
                      : '—'}
                </Td>
              </tr>
            ))
          )}
        </TBody>
      </Table>

      <Pagination page={page} totalPages={totalPages} onPageChange={goToPage} />
    </div>
  );
}
