// app/routes/admin/products/new.jsx
// New product — full editor shown immediately; product is created on save.

import { useActionData, useLoaderData, useNavigation } from 'react-router';
import { redirect } from 'react-router';

import ProductEditor, {
  NEW_VARIANT_ID,
} from '#/components/admin/product-editor';

import { getAdminSlotBlocksMap } from '#/core/admin/slots.server';
import {
  createBlankProduct,
  loadAdminProductEditorContext,
  persistAdminProduct,
  validatePrimarySlug,
} from '#/core/catalog/admin-product-form.server';

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export async function loader() {
  const [context, slotBlocks] = await Promise.all([
    loadAdminProductEditorContext(),
    getAdminSlotBlocksMap(['product.editor']),
  ]);

  return {
    ...context,
    slotBlocks,
    product: {
      id: null,
      publishedAt: null,
      createdAt: new Date().toISOString(),
      variants: [
        {
          id: NEW_VARIANT_ID,
          sku: '',
          inventoryCount: 0,
          inventoryTracked: true,
          position: 0,
          prices: {},
        },
      ],
      options: [],
      selectedCategoryIds: [],
      media: [],
    },
    translationMap: {},
    slugMap: {},
  };
}

// ---------------------------------------------------------------------------
// Action
// ---------------------------------------------------------------------------

export async function action({ request }) {
  const formData = await request.formData();
  const intent = formData.get('intent');

  if (intent !== 'create') {
    return { error: 'Invalid request.' };
  }

  const context = await loadAdminProductEditorContext();
  const primaryLocale = context.locales[0] ?? 'en';
  const slugError = await validatePrimarySlug(formData, primaryLocale);
  if (slugError.error) {
    return slugError;
  }

  const { id, defaultVariantId } = await createBlankProduct();

  await persistAdminProduct(id, formData, {
    variantIdMap: { [NEW_VARIANT_ID]: defaultVariantId },
  });

  return redirect(`/admin/products/${id}`);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AdminNewProductRoute() {
  const data = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSaving =
    navigation.state === 'submitting' &&
    navigation.formData?.get('intent') === 'create';

  return (
    <ProductEditor
      mode="create"
      product={data.product}
      locales={data.locales}
      currencies={data.currencies}
      translationMap={data.translationMap}
      slugMap={data.slugMap}
      allCategories={data.allCategories}
      actionData={actionData}
      isSaving={isSaving}
      slotBlocks={data.slotBlocks}
    />
  );
}
