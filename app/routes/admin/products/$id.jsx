// app/routes/admin/products/$id.jsx
// Full product editor — locale tabs, options + variants, per-currency price
// grid, media uploader, category picker, SEO, publish toggle.

import { useActionData, useLoaderData, useNavigation } from 'react-router';
import { redirect } from 'react-router';

import prisma from '#/libs/prisma.server';
import { getAdminSlotBlocksMap } from '#/core/admin/slots.server';
import {
  loadAdminProductEditorContext,
  persistAdminProduct,
} from '#/core/catalog/admin-product-form.server';
import {
  attachMedia,
  deleteProduct,
  detachMedia,
} from '#/core/catalog/index.server';
import { uploadMedia } from '#/core/storage/index.server';
import ProductEditor from '#/components/admin/product-editor';

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export async function loader({ params }) {
  const { id } = params;

  const [product, context, slotBlocks] = await Promise.all([
    prisma.product.findUniqueOrThrow({
      where: { id },
      include: {
        variants: {
          orderBy: { position: 'asc' },
          include: { prices: true },
        },
        options: {
          orderBy: { position: 'asc' },
          include: {
            values: { orderBy: { position: 'asc' } },
          },
        },
        categories: {
          orderBy: { position: 'asc' },
          select: { categoryId: true },
        },
        media: {
          orderBy: { position: 'asc' },
          include: { media: true },
        },
      },
    }),
    loadAdminProductEditorContext(),
    getAdminSlotBlocksMap(['product.editor']),
  ]);

  const translations = await prisma.translation.findMany({
    where: { entityType: 'product', entityId: id },
  });
  const translationMap = {};
  for (const t of translations) {
    if (!translationMap[t.locale]) translationMap[t.locale] = {};
    translationMap[t.locale][t.field] = t.value;
  }

  const slugRows = await prisma.slug.findMany({
    where: { entityType: 'product', entityId: id },
  });
  const slugMap = Object.fromEntries(slugRows.map((s) => [s.locale, s.slug]));

  return {
    ...context,
    slotBlocks,
    product: {
      id: product.id,
      publishedAt: product.publishedAt?.toISOString() ?? null,
      createdAt: product.createdAt.toISOString(),
      variants: product.variants.map((v) => ({
        id: v.id,
        sku: v.sku ?? '',
        inventoryCount: v.inventoryCount,
        inventoryTracked: v.inventoryTracked,
        position: v.position,
        prices: Object.fromEntries(
          v.prices.map((p) => [
            p.currency,
            {
              priceCents: p.priceCents,
              comparePriceCents: p.comparePriceCents ?? '',
            },
          ])
        ),
      })),
      options: product.options.map((o) => ({
        id: o.id,
        name: o.name,
        position: o.position,
        values: o.values.map((v) => ({ id: v.id, value: v.value })),
      })),
      selectedCategoryIds: product.categories.map((c) => c.categoryId),
      media: product.media.map((pm) => ({
        productMediaId: pm.id,
        mediaId: pm.mediaId,
        url: pm.media.url,
        altText: pm.media.altText ?? '',
        position: pm.position,
      })),
    },
    translationMap,
    slugMap,
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
    const file = formData.get('file');
    if (!file || typeof file === 'string') {
      return { ok: false, error: 'No file provided.' };
    }

    const { url, storageKey, mimeType, width, height } =
      await uploadMedia(file);

    const media = await prisma.media.create({
      data: { storageKey, url, mimeType, width, height },
    });

    const lastMedia = await prisma.productMedia.findFirst({
      where: { productId: id },
      orderBy: { position: 'desc' },
    });

    await attachMedia(id, media.id, (lastMedia?.position ?? -1) + 1);

    return { ok: true, intent: 'upload-media' };
  }

  if (intent === 'delete-media') {
    const mediaId = formData.get('mediaId');
    await detachMedia(id, mediaId);
    return { ok: true, intent: 'delete-media' };
  }

  if (intent === 'save') {
    await persistAdminProduct(id, formData);
    return { ok: true, intent: 'save' };
  }

  if (intent === 'delete') {
    await deleteProduct(id);
    return redirect('/admin/products');
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
