import {
  useActionData,
  useLoaderData,
  useNavigation,
  redirect,
} from 'react-router';

import {
  createCollection,
  listCollectionRuleOptions,
  listProductsForCollectionPicker,
  parseCollectionRulesFromForm,
} from '#/core/collections/index.server';
import CollectionEditor from '#/components/admin/collection-editor';

export async function loader() {
  const [products, ruleOptions] = await Promise.all([
    listProductsForCollectionPicker({ selectedProductIds: [] }),
    listCollectionRuleOptions(),
  ]);

  return {
    products,
    categories: ruleOptions.categories,
    tags: ruleOptions.tags,
  };
}

export async function action({ request }) {
  const formData = await request.formData();
  const collectionType = formData.get('collectionType')?.toString() ?? 'manual';
  const productIds = formData.getAll('productIds[]').map((id) => id.toString());

  try {
    const collection = await createCollection({
      handle: formData.get('handle'),
      title: formData.get('title'),
      description: formData.get('description'),
      collectionType,
      productIds: collectionType === 'manual' ? productIds : undefined,
      rules:
        collectionType === 'smart'
          ? parseCollectionRulesFromForm(formData)
          : undefined,
    });
    return redirect(`/admin/collections/${collection.id}`);
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
  const { products, categories, tags } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSaving = navigation.state === 'submitting';

  return (
    <CollectionEditor
      mode="create"
      products={products}
      categories={categories}
      tags={tags}
      actionData={actionData}
      isSaving={isSaving}
    />
  );
}
