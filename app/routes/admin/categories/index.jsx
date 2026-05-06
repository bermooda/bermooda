// app/routes/admin/categories/index.jsx
// Category tree editor — inline create, inline edit with locale tabs,
// up/down reorder, delete.

import {
  ChevronUpIcon,
  ChevronDownIcon,
  PencilSquareIcon,
  TrashIcon,
  PlusIcon,
  XMarkIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';
import { useState, useEffect } from 'react';
import {
  Form,
  useFetcher,
  useLoaderData,
  useNavigation,
} from 'react-router';
import clsx from 'clsx';

import prisma from '#/libs/prisma.server';
import { get } from '#/core/settings/index.server';

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export async function loader() {
  const [categories, localesRaw] = await Promise.all([
    prisma.category.findMany({
      orderBy: { position: 'asc' },
    }),
    get('locales'),
  ]);

  const locales = Array.isArray(localesRaw) ? localesRaw : ['en'];

  // Ensure 'en' is always in the list
  if (!locales.includes('en')) locales.unshift('en');

  const catIds = categories.map((c) => c.id);

  const [translations, slugRows] =
    catIds.length > 0
      ? await Promise.all([
          prisma.translation.findMany({
            where: { entityType: 'category', entityId: { in: catIds } },
          }),
          prisma.slug.findMany({
            where: { entityType: 'category', entityId: { in: catIds } },
          }),
        ])
      : [[], []];

  // Build maps
  const translationMap = {}; // entityId -> locale -> field -> value
  for (const t of translations) {
    if (!translationMap[t.entityId]) translationMap[t.entityId] = {};
    if (!translationMap[t.entityId][t.locale])
      translationMap[t.entityId][t.locale] = {};
    translationMap[t.entityId][t.locale][t.field] = t.value;
  }

  const slugMap = {}; // entityId -> locale -> slug
  for (const s of slugRows) {
    if (!slugMap[s.entityId]) slugMap[s.entityId] = {};
    slugMap[s.entityId][s.locale] = s.slug;
  }

  // Build flat tree: roots then their children recursively, each with a depth
  function buildTree(cats, parentId = null, depth = 0) {
    return cats
      .filter((c) => c.parentId === parentId)
      .sort((a, b) => a.position - b.position)
      .flatMap((c) => [
        {
          id: c.id,
          parentId: c.parentId ?? null,
          position: c.position,
          depth,
          enTitle:
            translationMap[c.id]?.en?.title ?? '',
          childCount: cats.filter((ch) => ch.parentId === c.id).length,
          translations: translationMap[c.id] ?? {},
          slugs: slugMap[c.id] ?? {},
        },
        ...buildTree(cats, c.id, depth + 1),
      ]);
  }

  const tree = buildTree(categories, null);

  // For parent selector: all categories with en title
  const allForSelect = categories.map((c) => ({
    id: c.id,
    title: translationMap[c.id]?.en?.title ?? `(${c.id.slice(0, 6)})`,
  }));

  return { tree, locales, allForSelect };
}

// ---------------------------------------------------------------------------
// Action
// ---------------------------------------------------------------------------

export async function action({ request }) {
  const formData = await request.formData();
  const intent = formData.get('intent');

  // ── Create ─────────────────────────────────────────────────────────────────
  if (intent === 'create') {
    const title = formData.get('title')?.toString().trim() ?? '';
    const slugValue = formData.get('slug')?.toString().trim() ?? '';
    const parentId = formData.get('parentId')?.toString().trim() || null;

    // Position = max sibling position + 1
    const lastSibling = await prisma.category.findFirst({
      where: { parentId },
      orderBy: { position: 'desc' },
    });
    const position = (lastSibling?.position ?? -1) + 1;

    const category = await prisma.category.create({
      data: { parentId, position },
    });

    if (title) {
      await prisma.translation.create({
        data: {
          entityType: 'category',
          entityId: category.id,
          locale: 'en',
          field: 'title',
          value: title,
        },
      });
    }

    if (slugValue) {
      try {
        await prisma.slug.create({
          data: {
            entityType: 'category',
            entityId: category.id,
            locale: 'en',
            slug: slugValue,
          },
        });
      } catch {
        // Slug collision — ignore
      }
    }

    return { ok: true, intent: 'create' };
  }

  // ── Save (edit) ────────────────────────────────────────────────────────────
  if (intent === 'save') {
    const id = formData.get('id')?.toString();
    if (!id) return { ok: false, error: 'Missing id.' };

    const locales = formData.getAll('locales[]');

    for (const locale of locales) {
      const title = formData.get(`title[${locale}]`)?.toString() ?? '';
      const slugValue = formData
        .get(`slug[${locale}]`)
        ?.toString()
        .trim();

      await prisma.translation.upsert({
        where: {
          entityType_entityId_locale_field: {
            entityType: 'category',
            entityId: id,
            locale,
            field: 'title',
          },
        },
        update: { value: title },
        create: {
          entityType: 'category',
          entityId: id,
          locale,
          field: 'title',
          value: title,
        },
      });

      if (slugValue) {
        try {
          await prisma.slug.upsert({
            where: {
              entityType_entityId_locale: {
                entityType: 'category',
                entityId: id,
                locale,
              },
            },
            update: { slug: slugValue },
            create: {
              entityType: 'category',
              entityId: id,
              locale,
              slug: slugValue,
            },
          });
        } catch {
          // Slug collision — skip
        }
      }
    }

    return { ok: true, intent: 'save' };
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  if (intent === 'delete') {
    const id = formData.get('id')?.toString();
    if (!id) return { ok: false, error: 'Missing id.' };

    // Cascade: delete children first (recursively), then translations/slugs,
    // then the category itself. Prisma onDelete: Restrict by default on self-
    // relations, so we do it manually.
    async function deleteRecursive(catId) {
      const children = await prisma.category.findMany({
        where: { parentId: catId },
      });
      for (const child of children) {
        await deleteRecursive(child.id);
      }
      await prisma.translation.deleteMany({
        where: { entityType: 'category', entityId: catId },
      });
      await prisma.slug.deleteMany({
        where: { entityType: 'category', entityId: catId },
      });
      await prisma.category.delete({ where: { id: catId } });
    }

    await deleteRecursive(id);
    return { ok: true, intent: 'delete' };
  }

  // ── Reorder up ────────────────────────────────────────────────────────────
  if (intent === 'reorder-up' || intent === 'reorder-down') {
    const id = formData.get('id')?.toString();
    if (!id) return { ok: false, error: 'Missing id.' };

    const current = await prisma.category.findUnique({ where: { id } });
    if (!current) return { ok: false, error: 'Not found.' };

    const siblings = await prisma.category.findMany({
      where: { parentId: current.parentId ?? null },
      orderBy: { position: 'asc' },
    });

    const idx = siblings.findIndex((s) => s.id === id);
    const swapIdx = intent === 'reorder-up' ? idx - 1 : idx + 1;

    if (swapIdx < 0 || swapIdx >= siblings.length) {
      return { ok: true, intent }; // already at boundary
    }

    const sibling = siblings[swapIdx];

    // Swap positions
    await prisma.$transaction([
      prisma.category.update({
        where: { id: current.id },
        data: { position: sibling.position },
      }),
      prisma.category.update({
        where: { id: sibling.id },
        data: { position: current.position },
      }),
    ]);

    return { ok: true, intent };
  }

  return { ok: false, error: 'Unknown intent.' };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function LocaleTabs({ locales, activeLocale, onSelect }) {
  return (
    <div className="flex gap-1 border-b border-gray-200 dark:border-zinc-700">
      {locales.map((locale) => (
        <button
          key={locale}
          type="button"
          onClick={() => onSelect(locale)}
          className={clsx(
            'rounded-t px-4 py-2 text-sm font-medium transition-colors',
            activeLocale === locale
              ? 'border-b-2 border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
              : 'text-gray-500 hover:text-gray-700 dark:text-zinc-400 dark:hover:text-zinc-200'
          )}
        >
          {locale.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

/** Inline edit form shown below the category row */
function InlineEditForm({ category, locales, onClose }) {
  const fetcher = useFetcher();
  const [activeLocale, setActiveLocale] = useState(locales[0] ?? 'en');
  const isSaving = fetcher.state !== 'idle';

  const saved =
    fetcher.state === 'idle' &&
    fetcher.data?.ok &&
    fetcher.data?.intent === 'save';

  return (
    <div className="bg-indigo-50 dark:bg-zinc-800/60 rounded-lg p-4 border border-indigo-200 dark:border-zinc-600">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-900 dark:text-white">
          Edit category
        </span>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200"
        >
          <XMarkIcon className="h-4 w-4" />
        </button>
      </div>

      {saved && (
        <div className="mb-3 flex items-center gap-1.5 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">
          <CheckIcon className="h-4 w-4" />
          Saved.
        </div>
      )}

      <fetcher.Form method="post">
        <input type="hidden" name="intent" value="save" />
        <input type="hidden" name="id" value={category.id} />
        {locales.map((l) => (
          <input key={l} type="hidden" name="locales[]" value={l} />
        ))}

        <LocaleTabs
          locales={locales}
          activeLocale={activeLocale}
          onSelect={setActiveLocale}
        />

        {locales.map((locale) => (
          <div
            key={locale}
            className={clsx('mt-3 space-y-3', locale !== activeLocale && 'hidden')}
          >
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-zinc-400">
                Title ({locale})
              </label>
              <input
                type="text"
                name={`title[${locale}]`}
                defaultValue={category.translations[locale]?.title ?? ''}
                placeholder="Category title"
                className="mt-1 block w-full rounded-md border-0 bg-white px-3 py-1.5 text-sm shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600 dark:bg-zinc-800 dark:text-white dark:ring-zinc-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-zinc-400">
                Slug ({locale})
              </label>
              <input
                type="text"
                name={`slug[${locale}]`}
                defaultValue={category.slugs[locale] ?? ''}
                placeholder="url-slug"
                className="mt-1 block w-full rounded-md border-0 bg-white px-3 py-1.5 text-sm shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600 dark:bg-zinc-800 dark:text-white dark:ring-zinc-600"
              />
            </div>
          </div>
        ))}

        <div className="mt-4 flex items-center gap-3">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-60"
          >
            {isSaving ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-gray-500 hover:text-gray-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            Close
          </button>
        </div>
      </fetcher.Form>
    </div>
  );
}

/** "Add Category" inline form */
function AddCategoryForm({ allForSelect }) {
  const [open, setOpen] = useState(false);
  const fetcher = useFetcher();
  const isSubmitting = fetcher.state !== 'idle';

  // We use a key to reset the form after submit
  const [formKey, setFormKey] = useState(0);

  // Close + reset after successful creation
  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data?.ok && open) {
      setOpen(false);
      setFormKey((k) => k + 1);
    }
  }, [fetcher.state, fetcher.data, open]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
      >
        <PlusIcon className="h-4 w-4" />
        Add Category
      </button>
    );
  }

  return (
    <div className="rounded-lg bg-white shadow-sm ring-1 ring-gray-200 dark:bg-zinc-900 dark:ring-zinc-700 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-900 dark:text-white">
          New Category
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded p-1 text-gray-400 hover:text-gray-600"
        >
          <XMarkIcon className="h-4 w-4" />
        </button>
      </div>

      <fetcher.Form key={formKey} method="post" className="space-y-3">
        <input type="hidden" name="intent" value="create" />

        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-zinc-400">
            Name (EN)
          </label>
          <input
            type="text"
            name="title"
            required
            placeholder="e.g. Apparel"
            className="mt-1 block w-full rounded-md border-0 bg-white px-3 py-1.5 text-sm shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600 dark:bg-zinc-800 dark:text-white dark:ring-zinc-600"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-zinc-400">
            Slug (EN)
          </label>
          <input
            type="text"
            name="slug"
            placeholder="apparel"
            className="mt-1 block w-full rounded-md border-0 bg-white px-3 py-1.5 text-sm shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600 dark:bg-zinc-800 dark:text-white dark:ring-zinc-600"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-zinc-400">
            Parent (optional)
          </label>
          <select
            name="parentId"
            defaultValue=""
            className="mt-1 block w-full rounded-md border-0 bg-white px-3 py-1.5 text-sm shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600 dark:bg-zinc-800 dark:text-white dark:ring-zinc-600"
          >
            <option value="">— None (root) —</option>
            {allForSelect.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.title}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-60"
          >
            {isSubmitting ? 'Creating…' : 'Create'}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-sm text-gray-500 hover:text-gray-700 dark:text-zinc-400"
          >
            Cancel
          </button>
        </div>
      </fetcher.Form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function AdminCategoriesRoute() {
  const { tree, locales, allForSelect } = useLoaderData();
  const navigation = useNavigation();
  const [editingId, setEditingId] = useState(null);

  const isReordering =
    navigation.state === 'submitting' &&
    (navigation.formData?.get('intent') === 'reorder-up' ||
      navigation.formData?.get('intent') === 'reorder-down');

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Categories
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {tree.length} categor{tree.length !== 1 ? 'ies' : 'y'}
          </p>
        </div>
        <AddCategoryForm allForSelect={allForSelect} />
      </div>

      {/* Tree table */}
      <div className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-200 dark:bg-zinc-900 dark:ring-zinc-700">
        {tree.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-gray-400 dark:text-zinc-500">
            No categories yet. Use the button above to create one.
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-zinc-800">
            {tree.map((cat) => (
              <div key={cat.id}>
                {/* Row */}
                <div
                  className={clsx(
                    'flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-zinc-800/50',
                    isReordering && 'opacity-60'
                  )}
                  style={{ paddingLeft: `${16 + cat.depth * 24}px` }}
                >
                  {/* Depth indicator */}
                  {cat.depth > 0 && (
                    <span className="mr-1 text-gray-300 dark:text-zinc-600 select-none">
                      {'└'}
                    </span>
                  )}

                  {/* Title */}
                  <span className="flex-1 text-sm font-medium text-gray-900 dark:text-white">
                    {cat.enTitle || (
                      <span className="text-gray-400 italic dark:text-zinc-500">
                        (untitled)
                      </span>
                    )}
                  </span>

                  {/* Position badge */}
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-500 dark:bg-zinc-800 dark:text-zinc-400">
                    pos {cat.position}
                  </span>

                  {/* Child count */}
                  {cat.childCount > 0 && (
                    <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400">
                      {cat.childCount} child{cat.childCount !== 1 ? 'ren' : ''}
                    </span>
                  )}

                  {/* Reorder */}
                  <div className="flex flex-col gap-0.5">
                    <Form method="post">
                      <input type="hidden" name="intent" value="reorder-up" />
                      <input type="hidden" name="id" value={cat.id} />
                      <button
                        type="submit"
                        title="Move up"
                        className="rounded p-0.5 text-gray-400 hover:text-gray-700 dark:hover:text-zinc-200"
                      >
                        <ChevronUpIcon className="h-3.5 w-3.5" />
                      </button>
                    </Form>
                    <Form method="post">
                      <input type="hidden" name="intent" value="reorder-down" />
                      <input type="hidden" name="id" value={cat.id} />
                      <button
                        type="submit"
                        title="Move down"
                        className="rounded p-0.5 text-gray-400 hover:text-gray-700 dark:hover:text-zinc-200"
                      >
                        <ChevronDownIcon className="h-3.5 w-3.5" />
                      </button>
                    </Form>
                  </div>

                  {/* Edit */}
                  <button
                    type="button"
                    onClick={() =>
                      setEditingId((prev) =>
                        prev === cat.id ? null : cat.id
                      )
                    }
                    title="Edit"
                    className={clsx(
                      'rounded p-1 transition-colors',
                      editingId === cat.id
                        ? 'text-indigo-600 dark:text-indigo-400'
                        : 'text-gray-400 hover:text-gray-700 dark:hover:text-zinc-200'
                    )}
                  >
                    <PencilSquareIcon className="h-4 w-4" />
                  </button>

                  {/* Delete */}
                  <Form
                    method="post"
                    onSubmit={(e) => {
                      if (
                        !window.confirm(
                          cat.childCount > 0
                            ? `Delete "${cat.enTitle || 'this category'}" and its ${cat.childCount} child categor${cat.childCount !== 1 ? 'ies' : 'y'}? This cannot be undone.`
                            : `Delete "${cat.enTitle || 'this category'}"? This cannot be undone.`
                        )
                      ) {
                        e.preventDefault();
                      }
                    }}
                  >
                    <input type="hidden" name="intent" value="delete" />
                    <input type="hidden" name="id" value={cat.id} />
                    <button
                      type="submit"
                      title="Delete"
                      className="rounded p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </Form>
                </div>

                {/* Inline edit panel */}
                {editingId === cat.id && (
                  <div className="px-4 pb-4">
                    <InlineEditForm
                      category={cat}
                      locales={locales}
                      onClose={() => setEditingId(null)}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
