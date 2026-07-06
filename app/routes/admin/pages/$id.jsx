import { useActionData, useLoaderData, useNavigation } from 'react-router';
import { redirect } from 'react-router';

import prisma from '#/libs/prisma.server';
import { deletePage, updatePage } from '#/core/content/index.server';
import { get } from '#/core/settings/index.server';
import PageEditor from '#/components/admin/page-editor';

export async function loader({ params }) {
  const { id } = params;
  const [localesRaw] = await Promise.all([get('locales')]);
  const locales = Array.isArray(localesRaw) ? localesRaw : ['en'];
  if (!locales.includes('en')) locales.unshift('en');

  const page = await prisma.page.findUniqueOrThrow({ where: { id } });

  const translations = await prisma.translation.findMany({
    where: { entityType: 'page', entityId: id },
  });
  const translationMap = {};
  for (const t of translations) {
    if (!translationMap[t.locale]) translationMap[t.locale] = {};
    translationMap[t.locale][t.field] = t.value;
  }

  const slugRows = await prisma.slug.findMany({
    where: { entityType: 'page', entityId: id },
  });
  const slugMap = Object.fromEntries(slugRows.map((s) => [s.locale, s.slug]));

  return {
    page: {
      id: page.id,
      type: page.type,
      status: page.status,
      publishedAt: page.publishedAt?.toISOString() ?? null,
      updatedAt: page.updatedAt.toISOString(),
    },
    locales,
    translationMap,
    slugMap,
  };
}

export async function action({ request, params }) {
  const formData = await request.formData();
  const intent = formData.get('intent');

  if (intent === 'delete') {
    await deletePage(params.id);
    return redirect('/admin/pages');
  }

  const locale = formData.get('locale')?.toString() ?? 'en';
  const status = formData.get('status')?.toString() ?? 'draft';
  const slug = formData.get('slug')?.toString().trim();
  const translations = {
    title: formData.get('title')?.toString() ?? '',
    body: formData.get('body')?.toString() ?? '',
    metaTitle: formData.get('metaTitle')?.toString() ?? '',
    metaDescription: formData.get('metaDescription')?.toString() ?? '',
  };

  try {
    await updatePage(params.id, { translations, slug, locale, status });
    return { ok: true };
  } catch (err) {
    return { error: err.message ?? 'Failed to save page.' };
  }
}

export default function AdminPageEditRoute() {
  const { page, locales, translationMap, slugMap } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSaving = navigation.state === 'submitting';

  return (
    <PageEditor
      mode="edit"
      page={page}
      locales={locales}
      translationMap={translationMap}
      slugMap={slugMap}
      actionData={actionData}
      isSaving={isSaving}
    />
  );
}
