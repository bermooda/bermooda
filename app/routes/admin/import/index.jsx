import { Form, useActionData, useLoaderData } from 'react-router';

import {
  IMPORT_TYPES,
  importCustomersCsv,
  importProductsCsv,
} from '#/core/imports/index.server';
import Field from '#/components/admin/form/field';
import PageHeader from '#/components/admin/page-header';
import { ButtonSubmit } from '#/components/ui/button';

export async function loader() {
  return { types: IMPORT_TYPES };
}

export async function action({ request }) {
  const formData = await request.formData();
  const type = formData.get('type')?.toString();
  const file = formData.get('file');

  if (!file || typeof file === 'string') {
    return { error: 'CSV file is required' };
  }

  const csvText = await file.text();

  if (type === 'products') {
    const result = await importProductsCsv(csvText);
    return { ok: true, type, result };
  }

  if (type === 'customers') {
    const result = await importCustomersCsv(csvText);
    return { ok: true, type, result };
  }

  return { error: 'Invalid import type' };
}

export function meta() {
  return [{ title: 'Import Data' }];
}

export default function AdminImportRoute() {
  const { types } = useLoaderData();
  const actionData = useActionData();

  return (
    <div>
      <PageHeader
        title="Import"
        subtitle="Upload CSV files matching export column formats."
      />
      <Form
        method="post"
        encType="multipart/form-data"
        className="max-w-lg space-y-4"
      >
        <Field label="Import type" htmlFor="type">
          <select
            id="type"
            name="type"
            className="w-full rounded-md border px-3 py-2"
            defaultValue="products"
          >
            {types.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
        <Field label="CSV file" htmlFor="file">
          <input
            id="file"
            name="file"
            type="file"
            accept=".csv,text/csv"
            required
          />
        </Field>
        <ButtonSubmit>Import</ButtonSubmit>
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
