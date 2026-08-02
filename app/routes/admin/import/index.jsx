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
import Field from '#/components/admin/form/field';
import PageHeader from '#/components/admin/page-header';
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
      <div className="mb-4 flex flex-wrap gap-3 text-sm">
        {types.map((type) => (
          <a
            key={type}
            href={`/admin/import?template=${type}`}
            className="text-stone-700 underline decoration-stone-300 underline-offset-2 hover:text-stone-900"
          >
            {t('admin.import.index.downloadTemplate', { type })}
          </a>
        ))}
      </div>
      <Form
        method="post"
        encType="multipart/form-data"
        className="max-w-lg space-y-4"
      >
        <Field label={t('admin.import.index.importType')} htmlFor="type">
          <select
            id="type"
            name="type"
            className="w-full rounded-md border px-3 py-2"
            defaultValue="products"
          >
            {types.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('admin.import.index.csvFile')} htmlFor="file">
          <input
            id="file"
            name="file"
            type="file"
            accept=".csv,text/csv"
            required
          />
        </Field>
        <ButtonSubmit>{t('admin.import.index.submit')}</ButtonSubmit>
      </Form>
      {actionData?.error && (
        <p className="mt-4 text-sm text-red-600">{actionData.error}</p>
      )}
      {actionData?.ok && (
        <pre className="mt-4 overflow-auto rounded bg-stone-100 p-4 text-xs">
          {JSON.stringify(actionData.result, null, 2)}
        </pre>
      )}
    </div>
  );
}
