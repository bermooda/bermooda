import clsx from 'clsx';
import { useState } from 'react';
import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
} from 'react-router';
import { redirect } from 'react-router';

import prisma from '#/libs/prisma.server';

import { deletePage, updatePage } from '#/core/content/index.server';
import { get } from '#/core/settings/index.server';

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

function LocaleTabs({ locales, active, onSelect }) {
  return (
    <div className="flex gap-1 border-b border-gray-200 dark:border-zinc-700">
      {locales.map((locale) => (
        <button
          key={locale}
          type="button"
          onClick={() => onSelect(locale)}
          className={clsx(
            'px-3 py-2 text-sm font-medium',
            active === locale
              ? 'border-b-2 border-indigo-600 text-indigo-600'
              : 'text-gray-500 hover:text-gray-700'
          )}
        >
          {locale.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

export default function AdminPageEditRoute() {
  const { page, locales, translationMap, slugMap } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const [activeLocale, setActiveLocale] = useState(locales[0] ?? 'en');
  const isSaving = navigation.state === 'submitting';

  const t = translationMap[activeLocale] ?? {};

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Edit Page
        </h1>
        <Form
          method="post"
          onSubmit={(e) => !confirm('Delete this page?') && e.preventDefault()}
        >
          <input type="hidden" name="intent" value="delete" />
          <button
            type="submit"
            className="text-sm text-red-600 hover:text-red-500"
          >
            Delete
          </button>
        </Form>
      </div>

      <Form
        method="post"
        className="space-y-6 rounded-lg bg-white p-6 shadow-sm ring-1 ring-gray-200 dark:bg-zinc-900 dark:ring-zinc-700"
      >
        <input type="hidden" name="locale" value={activeLocale} />

        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <span className="font-medium text-gray-700">Status</span>
            <select
              name="status"
              defaultValue={page.status}
              className="rounded-md border-0 py-1.5 text-sm shadow-sm ring-1 ring-gray-300 ring-inset"
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </label>
        </div>

        <LocaleTabs
          locales={locales}
          active={activeLocale}
          onSelect={setActiveLocale}
        />

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Title
            </label>
            <input
              name="title"
              type="text"
              defaultValue={t.title ?? ''}
              className="mt-1 block w-full rounded-md border-0 px-3 py-2 text-sm shadow-sm ring-1 ring-gray-300 ring-inset"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Slug
            </label>
            <input
              name="slug"
              type="text"
              defaultValue={slugMap[activeLocale] ?? ''}
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              className="mt-1 block w-full rounded-md border-0 px-3 py-2 text-sm shadow-sm ring-1 ring-gray-300 ring-inset"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Body
            </label>
            <textarea
              name="body"
              rows={10}
              defaultValue={t.body ?? ''}
              className="mt-1 block w-full rounded-md border-0 px-3 py-2 text-sm shadow-sm ring-1 ring-gray-300 ring-inset"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Meta title
            </label>
            <input
              name="metaTitle"
              type="text"
              defaultValue={t.metaTitle ?? ''}
              className="mt-1 block w-full rounded-md border-0 px-3 py-2 text-sm shadow-sm ring-1 ring-gray-300 ring-inset"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Meta description
            </label>
            <textarea
              name="metaDescription"
              rows={2}
              defaultValue={t.metaDescription ?? ''}
              className="mt-1 block w-full rounded-md border-0 px-3 py-2 text-sm shadow-sm ring-1 ring-gray-300 ring-inset"
            />
          </div>
        </div>

        {actionData?.error && (
          <p className="text-sm text-red-600">{actionData.error}</p>
        )}
        {actionData?.ok && <p className="text-sm text-green-600">Saved.</p>}

        <button
          type="submit"
          disabled={isSaving}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
        >
          {isSaving ? 'Saving…' : 'Save Page'}
        </button>
      </Form>
    </div>
  );
}
