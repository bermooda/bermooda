import { Form, useActionData, useLoaderData } from 'react-router';

import { authenticate } from '#/libs/auth/admin/index.server';
import { handleError } from '#/libs/error/index.server';
import { useT } from '#/core/i18n';
import {
  IMPORT_TYPES,
  resolveImportTemplate,
  runImport,
  serializeImportResult,
  validateImportType,
} from '#/core/imports/index.server';
import Card from '#/components/admin/card';
import Field from '#/components/admin/form/field';
import Input from '#/components/admin/form/input';
import Select from '#/components/admin/form/select';
import PageHeader from '#/components/admin/page-header';
import { ErrorAlert } from '#/components/ui/alert';
import { ButtonSubmit } from '#/components/ui/button';

export async function loader({ request }) {
  await authenticate(request);

  const url = new URL(request.url);
  const template = url.searchParams.get('template')?.trim();

  if (template) {
    try {
      validateImportType(template);
      const { csv, filename } = resolveImportTemplate(template);
      return new Response(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-store',
        },
      });
    } catch (err) {
      if (err.code === 'INVALID_IMPORT_TYPE') {
        throw new Response(err.message, { status: 400 });
      }
      throw err;
    }
  }

  return { types: IMPORT_TYPES };
}

export async function action({ request }) {
  await authenticate(request);

  try {
    const formData = await request.formData();
    const type = formData.get('type')?.toString();
    const file = formData.get('file');

    if (!file || typeof file === 'string') {
      return { error: 'CSV file is required' };
    }

    const csvText = await file.text();
    const result = await runImport(type, csvText);

    return {
      ok: true,
      type,
      result: serializeImportResult(result),
    };
  } catch (err) {
    if (err.code === 'INVALID_IMPORT_TYPE') {
      return { error: err.message };
    }
    return handleError(err, { source: 'admin.import' });
  }
}

export function meta() {
  return [{ title: 'Import Data' }];
}

export default function AdminImportRoute() {
  const t = useT();
  const { types } = useLoaderData();
  const actionData = useActionData();

  return (
    <div>
      <PageHeader
        title={t('admin.import.index.title')}
        subtitle={t('admin.import.index.subtitle')}
      />

      <div className="mb-6 flex flex-wrap gap-x-4 gap-y-2 text-sm">
        {types.map((type) => (
          <a
            key={type}
            href={`/admin/import?template=${type}`}
            className="text-accent hover:text-accent-hover decoration-accent/30 underline underline-offset-2"
          >
            {t('admin.import.index.downloadTemplate', { type })}
          </a>
        ))}
      </div>

      <Card className="max-w-lg">
        <Form method="post" encType="multipart/form-data" className="space-y-4">
          <Field label={t('admin.import.index.importType')} htmlFor="type">
            <Select id="type" name="type" defaultValue="products">
              {types.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('admin.import.index.csvFile')} htmlFor="file">
            <Input
              id="file"
              name="file"
              type="file"
              accept=".csv,text/csv"
              required
            />
          </Field>
          <ButtonSubmit>{t('admin.import.index.submit')}</ButtonSubmit>
        </Form>
      </Card>

      {actionData?.error ? (
        <div className="mt-4 max-w-lg">
          <ErrorAlert message={actionData.error} />
        </div>
      ) : null}
      {actionData?.ok ? (
        <pre className="border-border bg-surface-2 text-text mt-4 max-w-2xl overflow-auto rounded-lg border p-4 text-xs">
          {JSON.stringify(actionData.result, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}
