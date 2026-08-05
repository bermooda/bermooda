import {
  useActionData,
  useLoaderData,
  useNavigation,
  redirect,
} from 'react-router';

import {
  getCollection,
  listCollectionRuleOptions,
  listProductsForCollectionPicker,
  parseCollectionRulesFromForm,
  updateCollection,
  deleteCollection,
} from '#/core/collections/index.server';
import CollectionEditor from '#/components/admin/collection-editor';

export async function loader({ params }) {
  const collection = await getCollection(params.id);
  if (!collection) {
    throw new Response('Collection not found', { status: 404 });
  }

  const [products, ruleOptions] = await Promise.all([
    listProductsForCollectionPicker({
      selectedProductIds: collection.productIds ?? [],
    }),
    listCollectionRuleOptions(),
  ]);

  return {
    collection,
    products,
    categories: ruleOptions.categories,
    tags: ruleOptions.tags,
  };
}

export async function action({ request, params }) {
  const formData = await request.formData();
  const intent = formData.get('intent')?.toString();

  if (intent === 'delete') {
    await deleteCollection(params.id);
    return redirect('/admin/collections');
  }

  const collectionType = formData.get('collectionType')?.toString() ?? 'manual';
  const productIds = formData.getAll('productIds[]').map((id) => id.toString());

  try {
    await updateCollection(params.id, {
      handle: formData.get('handle'),
      title: formData.get('title'),
      description: formData.get('description'),
      collectionType,
      rules:
        collectionType === 'smart'
          ? parseCollectionRulesFromForm(formData)
          : undefined,
      productIds: collectionType === 'manual' ? productIds : undefined,
      published: formData.get('published') === 'on',
    });
    return { ok: true };
  } catch (err) {
    if (err.code === 'COLLECTION_NOT_FOUND') {
      throw new Response('Collection not found', { status: 404 });
    }
    if (err.code === 'COLLECTION_INVALID') {
      return { error: err.message };
    }
    throw err;
  }
}

export function meta({ loaderData }) {
  const title = loaderData?.collection?.title ?? 'Edit collection';
  return [{ title: `${title} — Collections` }];
}

export default function AdminEditCollectionRoute() {
  const { collection, products, categories, tags } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSaving = navigation.state === 'submitting';

  return (
    <CollectionEditor
      mode="edit"
      collection={collection}
      products={products}
      categories={categories}
      tags={tags}
      actionData={actionData}
      isSaving={isSaving}
    />
  );
}
