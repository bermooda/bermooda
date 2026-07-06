import { redirect } from 'react-router';
import { Form, useLoaderData } from 'react-router';

import { authenticate } from '#/libs/auth/admin.server';
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
  const { product, attributes, related } = useLoaderData();

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Merchandising: ${product.title}`}
        subtitle="Attributes, related products, and variant option mapping."
      />

      <section>
        <h2 className="mb-3 text-lg font-semibold">Filterable attributes</h2>
        <ul className="mb-4 divide-y rounded border">
          {attributes.map((attr) => (
            <li
              key={attr.id}
              className="flex items-center justify-between px-3 py-2"
            >
              <span>
                {attr.name}: {attr.values.map((v) => v.value).join(', ')}
              </span>
              <Form method="post">
                <input type="hidden" name="intent" value="deleteAttribute" />
                <input type="hidden" name="attributeId" value={attr.id} />
                <button type="submit" className="text-sm text-red-600">
                  Delete
                </button>
              </Form>
            </li>
          ))}
        </ul>
        <Form method="post" className="grid max-w-lg gap-3">
          <input type="hidden" name="intent" value="addAttribute" />
          <Field label="Name" htmlFor="name">
            <Input id="name" name="name" required />
          </Field>
          <Field label="Values (comma-separated)" htmlFor="values">
            <Input id="values" name="values" placeholder="Red, Blue, Green" />
          </Field>
          <ButtonSubmit>Add attribute</ButtonSubmit>
        </Form>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Related products</h2>
        <Form method="post" className="max-w-lg space-y-3">
          <input type="hidden" name="intent" value="setRelated" />
          <Field label="Related product IDs" htmlFor="relatedIds">
            <Input
              id="relatedIds"
              name="relatedIds"
              defaultValue={related.map((r) => r.relatedId).join(', ')}
            />
          </Field>
          <ButtonSubmit>Save related products</ButtonSubmit>
        </Form>
      </section>
    </div>
  );
}
