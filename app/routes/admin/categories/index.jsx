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
import { useState } from 'react';
import {
  Form,
  Link,
  useFetcher,
  useLoaderData,
  useNavigation,
} from 'react-router';

import { handleAdminActionError } from '#/libs/api/admin-ui.server';
import {
  deleteCategoryRecursive,
  loadCategoryAdminTreeData,
  reorderCategory,
  saveCategoryAdminForm,
} from '#/core/catalog/admin.server';
import Badge from '#/components/admin/badge';
import Card from '#/components/admin/card';
import Field from '#/components/admin/form/field';
import Input from '#/components/admin/form/input';
import Textarea from '#/components/admin/form/textarea';
import PageHeader from '#/components/admin/page-header';
import { SuccessAlert } from '#/components/ui/alert';
import Button, { ButtonSubmit } from '#/components/ui/button';

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export async function loader() {
  return loadCategoryAdminTreeData();
}

// ---------------------------------------------------------------------------
// Action
// ---------------------------------------------------------------------------

export async function action({ request }) {
  const formData = await request.formData();
  const intent = formData.get('intent');

  // ── Save (edit) ────────────────────────────────────────────────────────────
  if (intent === 'save') {
    const id = formData.get('id')?.toString();
    if (!id) return { ok: false, error: 'Missing id.' };

    try {
      await saveCategoryAdminForm(id, formData);
      return { ok: true, intent: 'save' };
    } catch (err) {
      return handleAdminActionError(err, {
        source: 'admin.categories.save',
        intent: 'save',
        userMessage: 'Could not save category.',
      });
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  if (intent === 'delete') {
    const id = formData.get('id')?.toString();
    if (!id) return { ok: false, error: 'Missing id.' };

    try {
      await deleteCategoryRecursive(id);
      return { ok: true, intent: 'delete' };
    } catch (err) {
      return handleAdminActionError(err, {
        source: 'admin.categories.delete',
        intent: 'delete',
        userMessage: 'Could not delete category.',
      });
    }
  }

  // ── Reorder up/down ───────────────────────────────────────────────────────
  if (intent === 'reorder-up' || intent === 'reorder-down') {
    const id = formData.get('id')?.toString();
    if (!id) return { ok: false, error: 'Missing id.' };

    try {
      await reorderCategory(id, intent);
      return { ok: true, intent };
    } catch (err) {
      return handleAdminActionError(err, {
        source: 'admin.categories.reorder',
        intent,
        knownCodes: {
          NOT_FOUND: { ok: false, error: 'Not found.' },
        },
        userMessage: 'Could not reorder category.',
      });
    }
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

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function AdminCategoriesRoute() {
  const { tree, locales } = useLoaderData();
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
        actions={
          <Link
            to="/admin/categories/new"
            className="bg-accent text-accent-fg hover:bg-accent-hover focus-visible:outline-accent inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-semibold shadow-sm transition focus-visible:outline focus-visible:outline-offset-2"
          >
            <PlusIcon className="h-4 w-4" />
            New category
          </Link>
        }
        className="mb-6"
      />

      {/* Tree table */}
      <Card padded={false} className="overflow-hidden">
        {tree.length === 0 ? (
          <div className="text-text-muted px-4 py-10 text-center text-sm">
            No categories yet.{' '}
            <Link
              to="/admin/categories/new"
              className="text-accent hover:underline"
            >
              Create your first category
            </Link>
            .
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
