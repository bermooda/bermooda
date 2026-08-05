import { Form, redirect, useLoaderData } from 'react-router';

import { authenticate } from '#/libs/auth/admin/index.server';
import {
  listProductAttributes,
  createProductAttribute,
  deleteProductAttribute,
} from '#/core/catalog/attributes.server';
import { getProduct } from '#/core/catalog/index.server';
import {
  listProductRelations,
  setProductRelations,
} from '#/core/catalog/relations.server';
import { useT } from '#/core/i18n';
import Breadcrumbs from '#/components/admin/breadcrumbs';
import FormSection from '#/components/admin/form-section';
import Field from '#/components/admin/form/field';
import Input from '#/components/admin/form/input';
import PageHeader from '#/components/admin/page-header';
import { ButtonSubmit } from '#/components/ui/button';

export async function loader({ request, params }) {
  await authenticate(request);
  const product = await getProduct(params.id, { locale: 'en' });
  if (!product) throw new Response('Not found', { status: 404 });

  const [attributes, related] = await Promise.all([
    listProductAttributes(params.id),
    listProductRelations(params.id, 'related'),
  ]);

  return { product, attributes, related };
}

export async function action({ request, params }) {
  await authenticate(request);
  const formData = await request.formData();
  const intent = formData.get('intent');

  if (intent === 'addAttribute') {
    const name = formData.get('name')?.toString().trim();
    const valuesRaw = formData.get('values')?.toString().trim();
    if (!name) return { error: 'Attribute name required' };
    const values = valuesRaw ? valuesRaw.split(',').map((v) => v.trim()) : [];
    await createProductAttribute(params.id, { name, values });
  } else if (intent === 'deleteAttribute') {
    await deleteProductAttribute(formData.get('attributeId'));
  } else if (intent === 'setRelated') {
    const idsRaw = formData.get('relatedIds')?.toString().trim();
    const relatedIds = idsRaw
      ? idsRaw
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean)
      : [];
    await setProductRelations(params.id, 'related', relatedIds);
    return redirect(`/admin/products/${params.id}/merchandising`);
  }

  return redirect(`/admin/products/${params.id}/merchandising`);
}

export function meta({ loaderData }) {
  return [
    { title: `Merchandising — ${loaderData?.product?.title ?? 'Product'}` },
  ];
}

export default function AdminProductMerchandisingRoute() {
  const t = useT();
  const { product, attributes, related } = useLoaderData();
  const productTitle =
    product.title ??
    t('admin.products.editor.fallbackTitle', { id: product.id });

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              {
                label: t('admin.products.index.title'),
                href: '/admin/products',
              },
              {
                label: productTitle,
                href: `/admin/products/${product.id}`,
              },
              { label: t('admin.products.merchandising.pageTitle') },
            ]}
          />
        }
        title={t('admin.products.merchandising.pageTitle')}
        subtitle={t('admin.products.merchandising.subtitle')}
      />

      <div className="space-y-12">
        <FormSection
          title={t('admin.products.merchandising.attributesHeading')}
          description={t('admin.products.merchandising.attributesDescription')}
        >
          <ul className="border-border divide-border mb-6 divide-y rounded-md border">
            {attributes.length === 0 ? (
              <li className="text-text-muted px-3 py-2 text-sm">
                {t('admin.products.merchandising.noAttributes')}
              </li>
            ) : (
              attributes.map((attr) => (
                <li
                  key={attr.id}
                  className="flex items-center justify-between gap-3 px-3 py-2"
                >
                  <span className="text-text text-sm">
                    <span className="font-medium">{attr.name}</span>
                    <span className="text-text-muted">
                      : {attr.values.map((v) => v.value).join(', ')}
                    </span>
                  </span>
                  <Form method="post">
                    <input
                      type="hidden"
                      name="intent"
                      value="deleteAttribute"
                    />
                    <input type="hidden" name="attributeId" value={attr.id} />
                    <button
                      type="submit"
                      className="text-danger hover:text-danger/80 text-sm font-semibold"
                    >
                      {t('admin.products.merchandising.delete')}
                    </button>
                  </Form>
                </li>
              ))
            )}
          </ul>
          <Form
            method="post"
            className="grid max-w-2xl grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6"
          >
            <input type="hidden" name="intent" value="addAttribute" />
            <Field
              label={t('admin.products.merchandising.name')}
              htmlFor="name"
              className="sm:col-span-3"
            >
              <Input id="name" name="name" required />
            </Field>
            <Field
              label={t('admin.products.merchandising.values')}
              htmlFor="values"
              className="sm:col-span-3"
            >
              <Input
                id="values"
                name="values"
                placeholder={t(
                  'admin.products.merchandising.valuesPlaceholder'
                )}
              />
            </Field>
            <div className="sm:col-span-6">
              <ButtonSubmit>
                {t('admin.products.merchandising.addAttribute')}
              </ButtonSubmit>
            </div>
          </Form>
        </FormSection>

        <FormSection
          title={t('admin.products.merchandising.relatedHeading')}
          description={t('admin.products.merchandising.relatedDescription')}
          last
        >
          <Form
            method="post"
            className="grid max-w-2xl grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6"
          >
            <input type="hidden" name="intent" value="setRelated" />
            <Field
              label={t('admin.products.merchandising.relatedIds')}
              htmlFor="relatedIds"
              className="col-span-full"
            >
              <Input
                id="relatedIds"
                name="relatedIds"
                defaultValue={related.map((r) => r.relatedId).join(', ')}
              />
            </Field>
            <div className="sm:col-span-6">
              <ButtonSubmit>
                {t('admin.products.merchandising.saveRelated')}
              </ButtonSubmit>
            </div>
          </Form>
        </FormSection>
      </div>
    </div>
  );
}
