// app/routes/admin/products/$id.jsx
// Full product editor — locale tabs, options + variants, per-currency price
// grid, media uploader, category picker, SEO, publish toggle.

import { useActionData, useLoaderData, useNavigation } from 'react-router';
import { redirect } from 'react-router';

import { handleAdminActionError } from '#/libs/api/admin-ui.server';
import { getAdminSlotBlocksMap } from '#/core/admin/slots.server';
import {
  loadAdminProductEditorContext,
  persistAdminProduct,
} from '#/core/catalog/admin-product-form.server';
import { loadAdminProductEditorData } from '#/core/catalog/admin.server';
import {
  deleteProduct,
  detachMedia,
  uploadProductMedia,
} from '#/core/catalog/index.server';
import ProductEditor from '#/components/admin/product-editor';

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export async function loader({ params }) {
  const { id } = params;

  const [editorData, context, slotBlocks] = await Promise.all([
    loadAdminProductEditorData(id),
    loadAdminProductEditorContext(),
    getAdminSlotBlocksMap(['product.editor']),
  ]);

  return {
    ...context,
    ...editorData,
    slotBlocks,
  };
}

// ---------------------------------------------------------------------------
// Action
// ---------------------------------------------------------------------------

export async function action({ request, params }) {
  const { id } = params;
  const formData = await request.formData();
  const intent = formData.get('intent');

  if (intent === 'upload-media') {
    try {
      await uploadProductMedia(id, formData.get('file'));
      return { ok: true, intent: 'upload-media' };
    } catch (err) {
      return handleAdminActionError(err, {
        source: 'admin.products.upload-media',
        intent: 'upload-media',
        userMessage: err instanceof Error ? err.message : 'Upload failed.',
      });
    }
  }

  if (intent === 'delete-media') {
    const mediaId = formData.get('mediaId');
    try {
      await detachMedia(id, mediaId);
      return { ok: true, intent: 'delete-media' };
    } catch (err) {
      return handleAdminActionError(err, {
        source: 'admin.products.delete-media',
        intent: 'delete-media',
        userMessage: 'Could not remove media.',
      });
    }
  }

  if (intent === 'save') {
    try {
      await persistAdminProduct(id, formData);
      return { ok: true, intent: 'save' };
    } catch (err) {
      return handleAdminActionError(err, {
        source: 'admin.products.save',
        intent: 'save',
        userMessage: 'Could not save product.',
      });
    }
  }

  if (intent === 'delete') {
    try {
      await deleteProduct(id);
      return redirect('/admin/products');
    } catch (err) {
      return handleAdminActionError(err, {
        source: 'admin.products.delete',
        intent: 'delete',
        userMessage: 'Could not delete product.',
      });
    }
  }

  return { ok: false, error: 'Unknown intent.' };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AdminProductRoute() {
  const data = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSaving =
    navigation.state === 'submitting' &&
    navigation.formData?.get('intent') === 'save';

  return (
    <ProductEditor
      mode="edit"
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
