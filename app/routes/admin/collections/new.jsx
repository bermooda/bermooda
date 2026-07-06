import { redirect } from 'react-router';
import { Form } from 'react-router';

import Field from '#/components/admin/form/field';
import Input from '#/components/admin/form/input';
import Select from '#/components/admin/form/select';
import PageHeader from '#/components/admin/page-header';
import Button, { ButtonSubmit } from '#/components/ui/button';

import { createCollection } from '#/core/collections/index.server';

export async function action({ request }) {
  const formData = await request.formData();

  try {
    await createCollection({
      handle: formData.get('handle'),
      title: formData.get('title'),
      collectionType: formData.get('collectionType'),
      productIds: formData.get('productIds'),
    });
    return redirect('/admin/collections');
  } catch (err) {
    if (err.code === 'COLLECTION_INVALID') {
      return { error: err.message };
    }
    throw err;
  }
}

export function meta() {
  return [{ title: 'New Collection' }];
}

export default function AdminNewCollectionRoute() {
  return (
    <div>
      <PageHeader
        title="New collection"
        subtitle="Create a manual or smart collection."
      />
      <Form method="post" className="max-w-lg space-y-4">
        <Field label="Handle" htmlFor="handle">
          <Input id="handle" name="handle" required />
        </Field>
        <Field label="Title" htmlFor="title">
          <Input id="title" name="title" required />
        </Field>
        <Field label="Collection type" htmlFor="collectionType">
          <Select
            id="collectionType"
            name="collectionType"
            defaultValue="manual"
          >
            <option value="manual">Manual</option>
            <option value="smart">Smart (rule-based)</option>
          </Select>
        </Field>
        <Field
          label="Product IDs (manual collections only)"
          htmlFor="productIds"
        >
          <Input id="productIds" name="productIds" />
        </Field>
        <div className="flex gap-3">
          <ButtonSubmit>Create collection</ButtonSubmit>
          <Button as="a" href="/admin/collections" variant="secondary">
            Cancel
          </Button>
        </div>
      </Form>
    </div>
  );
}
