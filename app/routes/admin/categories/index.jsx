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
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { useState, useEffect } from 'react';
import { Form, useFetcher, useLoaderData, useNavigation } from 'react-router';

import prisma from '#/libs/prisma.server';
import Badge from '#/components/admin/badge';
import Card from '#/components/admin/card';
import Field from '#/components/admin/form/field';
import Input from '#/components/admin/form/input';
import Select from '#/components/admin/form/select';
import Textarea from '#/components/admin/form/textarea';
import PageHeader from '#/components/admin/page-header';
import { SuccessAlert } from '#/components/ui/alert';
import Button, { ButtonSubmit } from '#/components/ui/button';

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
          enTitle: translationMap[c.id]?.en?.title ?? '',
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
      const slugValue = formData.get(`slug[${locale}]`)?.toString().trim();
      const metaTitle = formData.get(`metaTitle[${locale}]`)?.toString() ?? '';
      const metaDescription =
        formData.get(`metaDescription[${locale}]`)?.toString() ?? '';

      for (const [field, value] of [
        ['title', title],
        ['metaTitle', metaTitle],
        ['metaDescription', metaDescription],
      ]) {
        await prisma.translation.upsert({
          where: {
            entityType_entityId_locale_field: {
              entityType: 'category',
              entityId: id,
              locale,
              field,
            },
          },
          update: { value },
          create: {
            entityType: 'category',
            entityId: id,
            locale,
            field,
            value,
          },
        });
      }

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
    <div className="border-border flex gap-1 border-b">
      {locales.map((locale) => (
        <button
          key={locale}
          type="button"
          onClick={() => onSelect(locale)}
          className={clsx(
            'rounded-t px-4 py-2 text-sm font-medium transition-colors',
            activeLocale === locale
              ? 'border-accent text-accent border-b-2'
              : 'text-text-muted hover:text-text'
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
    <div className="border-border bg-surface-2 rounded-lg border p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-text text-sm font-semibold">Edit category</span>
        <button
          type="button"
          onClick={onClose}
          className="text-text-muted hover:text-text rounded p-1"
        >
          <XMarkIcon className="h-4 w-4" />
        </button>
      </div>

      {saved && <SuccessAlert message="Saved." />}

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
            className={clsx(
              'mt-3 space-y-3',
              locale !== activeLocale && 'hidden'
            )}
          >
            <Field label={`Title (${locale})`} className="space-y-1">
              <Input
                type="text"
                name={`title[${locale}]`}
                defaultValue={category.translations[locale]?.title ?? ''}
                placeholder="Category title"
              />
            </Field>
            <Field label={`Slug (${locale})`} className="space-y-1">
              <Input
                type="text"
                name={`slug[${locale}]`}
                defaultValue={category.slugs[locale] ?? ''}
                placeholder="url-slug"
              />
            </Field>
            <Field label={`Meta title (${locale})`} className="space-y-1">
              <Input
                type="text"
                name={`metaTitle[${locale}]`}
                defaultValue={category.translations[locale]?.metaTitle ?? ''}
              />
            </Field>
            <Field label={`Meta description (${locale})`} className="space-y-1">
              <Textarea
                name={`metaDescription[${locale}]`}
                rows={2}
                defaultValue={
                  category.translations[locale]?.metaDescription ?? ''
                }
              />
            </Field>
          </div>
        ))}

        <div className="mt-4 flex items-center gap-3">
          <ButtonSubmit loading={isSaving}>Save</ButtonSubmit>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
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
      <Button variant="primary" onClick={() => setOpen(true)}>
        <PlusIcon className="mr-1.5 h-4 w-4" />
        Add Category
      </Button>
    );
  }

  return (
    <Card className="w-full sm:w-80">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-text text-sm font-semibold">New Category</span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-text-muted hover:text-text rounded p-1"
        >
          <XMarkIcon className="h-4 w-4" />
        </button>
      </div>

      <fetcher.Form key={formKey} method="post" className="space-y-3">
        <input type="hidden" name="intent" value="create" />

        <Field label="Name (EN)" className="space-y-1">
          <Input type="text" name="title" required placeholder="e.g. Apparel" />
        </Field>

        <Field label="Slug (EN)" className="space-y-1">
          <Input type="text" name="slug" placeholder="apparel" />
        </Field>

        <Field label="Parent (optional)" className="space-y-1">
          <Select name="parentId" defaultValue="">
            <option value="">— None (root) —</option>
            {allForSelect.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.title}
              </option>
            ))}
          </Select>
        </Field>

        <div className="flex items-center gap-3 pt-1">
          <ButtonSubmit loading={isSubmitting}>Create</ButtonSubmit>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
      </fetcher.Form>
    </Card>
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
      <PageHeader
        title="Categories"
        subtitle={`${tree.length} categor${tree.length !== 1 ? 'ies' : 'y'}`}
        actions={<AddCategoryForm allForSelect={allForSelect} />}
        className="mb-6"
      />

      {/* Tree table */}
      <Card padded={false} className="overflow-hidden">
        {tree.length === 0 ? (
          <div className="text-text-muted px-4 py-10 text-center text-sm">
            No categories yet. Use the button above to create one.
          </div>
        ) : (
          <div className="divide-border divide-y">
            {tree.map((cat) => (
              <div key={cat.id}>
                {/* Row */}
                <div
                  className={clsx(
                    'hover:bg-surface-2/50 flex items-center gap-3 px-4 py-3',
                    isReordering && 'opacity-60'
                  )}
                  style={{ paddingLeft: `${16 + cat.depth * 24}px` }}
                >
                  {/* Depth indicator */}
                  {cat.depth > 0 && (
                    <span className="text-text-muted mr-1 select-none">
                      {'└'}
                    </span>
                  )}

                  {/* Title */}
                  <span className="text-text flex-1 text-sm font-medium">
                    {cat.enTitle || (
                      <span className="text-text-muted italic">(untitled)</span>
                    )}
                  </span>

                  {/* Position badge */}
                  <span className="bg-surface-2 text-text-muted rounded px-1.5 py-0.5 font-mono text-xs">
                    pos {cat.position}
                  </span>

                  {/* Child count */}
                  {cat.childCount > 0 && (
                    <Badge tone="accent">
                      {cat.childCount} child{cat.childCount !== 1 ? 'ren' : ''}
                    </Badge>
                  )}

                  {/* Reorder */}
                  <div className="flex flex-col gap-0.5">
                    <Form method="post">
                      <input type="hidden" name="intent" value="reorder-up" />
                      <input type="hidden" name="id" value={cat.id} />
                      <button
                        type="submit"
                        title="Move up"
                        className="text-text-muted hover:text-text rounded p-0.5"
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
                        className="text-text-muted hover:text-text rounded p-0.5"
                      >
                        <ChevronDownIcon className="h-3.5 w-3.5" />
                      </button>
                    </Form>
                  </div>

                  {/* Edit */}
                  <button
                    type="button"
                    onClick={() =>
                      setEditingId((prev) => (prev === cat.id ? null : cat.id))
                    }
                    title="Edit"
                    className={clsx(
                      'rounded p-1 transition-colors',
                      editingId === cat.id
                        ? 'text-accent'
                        : 'text-text-muted hover:text-text'
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
                      className="text-text-muted hover:text-danger rounded p-1"
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
      </Card>
    </div>
  );
}
