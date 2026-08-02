import { redirect } from 'react-router';
import { Form } from 'react-router';

import { createCollection } from '#/core/collections/index.server';
import { useT } from '#/core/i18n';
import Field from '#/components/admin/form/field';
import Input from '#/components/admin/form/input';
import Select from '#/components/admin/form/select';
import PageHeader from '#/components/admin/page-header';
import Button, { ButtonSubmit } from '#/components/ui/button';

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
  const t = useT();

  return (
    <div>
      <PageHeader
        title={t('admin.collections.new.title')}
        subtitle={t('admin.collections.new.subtitle')}
      />
      <Form method="post" className="max-w-lg space-y-4">
        <Field label={t('admin.collections.new.handle')} htmlFor="handle">
          <Input id="handle" name="handle" required />
        </Field>
        <Field label={t('admin.collections.new.titleLabel')} htmlFor="title">
          <Input id="title" name="title" required />
        </Field>
        <Field
          label={t('admin.collections.new.collectionType')}
          htmlFor="collectionType"
        >
          <Select
            id="collectionType"
            name="collectionType"
            defaultValue="manual"
          >
            <option value="manual">
              {t('admin.collections.new.typeManual')}
            </option>
            <option value="smart">
              {t('admin.collections.new.typeSmart')}
            </option>
          </Select>
        </Field>
        <Field
          label={t('admin.collections.new.productIds')}
          htmlFor="productIds"
        >
          <Input id="productIds" name="productIds" />
        </Field>
        <div className="flex gap-3">
          <ButtonSubmit>{t('admin.collections.new.create')}</ButtonSubmit>
          <Button as="a" href="/admin/collections" variant="secondary">
            {t('common.cancel')}
          </Button>
        </div>
      </Form>
    </div>
  );
}
