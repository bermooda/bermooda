import clsx from 'clsx';
import { useState } from 'react';
import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
} from 'react-router';

import prisma from '#/libs/prisma.server';

import {
  getMenuForAdmin,
  listMenus,
  upsertMenu,
} from '#/core/content/index.server';

const MENU_HANDLES = ['main', 'footer', 'sub-header'];

export async function loader({ request }) {
  const url = new URL(request.url);
  const handle = url.searchParams.get('handle') || 'main';

  const [menus, menu, pages, categories] = await Promise.all([
    listMenus(),
    getMenuForAdmin(handle),
    prisma.page.findMany({
      where: { status: 'published' },
      orderBy: { position: 'asc' },
    }),
    prisma.category.findMany({ orderBy: { position: 'asc' } }),
  ]);

  const pageIds = pages.map((p) => p.id);
  const catIds = categories.map((c) => c.id);

  const [pageTitles, catTitles] = await Promise.all([
    pageIds.length
      ? prisma.translation.findMany({
          where: {
            entityType: 'page',
            entityId: { in: pageIds },
            locale: 'en',
            field: 'title',
          },
        })
      : [],
    catIds.length
      ? prisma.translation.findMany({
          where: {
            entityType: 'category',
            entityId: { in: catIds },
            locale: 'en',
            field: 'title',
          },
        })
      : [],
  ]);

  return {
    handle,
    menus,
    menu,
    pages: pages.map((p) => ({
      id: p.id,
      title:
        pageTitles.find((t) => t.entityId === p.id)?.value ?? p.id.slice(0, 8),
    })),
    categories: categories.map((c) => ({
      id: c.id,
      title:
        catTitles.find((t) => t.entityId === c.id)?.value ?? c.id.slice(0, 8),
    })),
  };
}

export async function action({ request }) {
  const formData = await request.formData();
  const handle = formData.get('handle')?.toString() ?? 'main';
  const title = formData.get('title')?.toString() ?? handle;
  const itemCount = parseInt(formData.get('itemCount')?.toString() ?? '0', 10);

  const items = [];
  for (let i = 0; i < itemCount; i++) {
    const label = formData.get(`items[${i}][label]`)?.toString() ?? '';
    const url = formData.get(`items[${i}][url]`)?.toString().trim() || null;
    const pageId = formData.get(`items[${i}][pageId]`)?.toString() || null;
    const categoryId =
      formData.get(`items[${i}][categoryId]`)?.toString() || null;
    const position = parseInt(
      formData.get(`items[${i}][position]`)?.toString() ?? String(i),
      10
    );
    const openInNew = formData.get(`items[${i}][openInNew]`) === 'on';

    if (!label && !pageId && !categoryId && !url) continue;

    items.push({
      label,
      url: pageId || categoryId ? null : url,
      pageId,
      categoryId,
      position,
      openInNew,
    });
  }

  await upsertMenu(handle, { title, items });
  return { ok: true, handle };
}

export default function AdminMenusRoute() {
  const { handle, menus, menu, pages, categories } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const [items, setItems] = useState(menu?.items ?? []);
  const isSaving = navigation.state === 'submitting';

  function addItem() {
    setItems((prev) => [
      ...prev,
      {
        label: '',
        url: '',
        pageId: '',
        categoryId: '',
        position: prev.length,
        openInNew: false,
      },
    ]);
  }

  function removeItem(index) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function updateItem(index, field, value) {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white">
        Menus
      </h1>
      <p className="mb-6 text-sm text-gray-500">
        Edit navigation menus used in the storefront theme.
      </p>

      <div className="mb-4 flex gap-2">
        {MENU_HANDLES.map((h) => (
          <a
            key={h}
            href={`?handle=${h}`}
            className={clsx(
              'rounded-full px-3 py-1 text-sm font-medium capitalize',
              handle === h
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 dark:bg-zinc-800'
            )}
          >
            {h}
          </a>
        ))}
      </div>

      <Form
        method="post"
        className="space-y-4 rounded-lg bg-white p-6 shadow-sm ring-1 ring-gray-200 dark:bg-zinc-900 dark:ring-zinc-700"
      >
        <input type="hidden" name="handle" value={handle} />
        <input type="hidden" name="itemCount" value={items.length} />

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Menu title
          </label>
          <input
            name="title"
            type="text"
            defaultValue={menu?.title ?? handle}
            className="mt-1 block w-full max-w-md rounded-md border-0 px-3 py-2 text-sm shadow-sm ring-1 ring-gray-300 ring-inset"
          />
        </div>

        <div className="space-y-3">
          {items.map((item, index) => (
            <div
              key={index}
              className="grid gap-3 rounded-md border border-gray-200 p-4 md:grid-cols-2 dark:border-zinc-700"
            >
              <input
                type="hidden"
                name={`items[${index}][position]`}
                value={index}
              />
              <div>
                <label className="text-xs text-gray-500">Label</label>
                <input
                  name={`items[${index}][label]`}
                  value={item.label}
                  onChange={(e) => updateItem(index, 'label', e.target.value)}
                  className="mt-1 block w-full rounded-md border-0 px-3 py-1.5 text-sm shadow-sm ring-1 ring-gray-300 ring-inset"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">Custom URL</label>
                <input
                  name={`items[${index}][url]`}
                  value={item.url ?? ''}
                  onChange={(e) => updateItem(index, 'url', e.target.value)}
                  placeholder="/about"
                  className="mt-1 block w-full rounded-md border-0 px-3 py-1.5 text-sm shadow-sm ring-1 ring-gray-300 ring-inset"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">Link to page</label>
                <select
                  name={`items[${index}][pageId]`}
                  value={item.pageId ?? ''}
                  onChange={(e) => updateItem(index, 'pageId', e.target.value)}
                  className="mt-1 block w-full rounded-md border-0 px-3 py-1.5 text-sm shadow-sm ring-1 ring-gray-300 ring-inset"
                >
                  <option value="">—</option>
                  {pages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500">
                  Link to category
                </label>
                <select
                  name={`items[${index}][categoryId]`}
                  value={item.categoryId ?? ''}
                  onChange={(e) =>
                    updateItem(index, 'categoryId', e.target.value)
                  }
                  className="mt-1 block w-full rounded-md border-0 px-3 py-1.5 text-sm shadow-sm ring-1 ring-gray-300 ring-inset"
                >
                  <option value="">—</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end justify-between md:col-span-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name={`items[${index}][openInNew]`}
                    defaultChecked={item.openInNew}
                  />
                  Open in new tab
                </label>
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  className="text-sm text-red-600"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addItem}
          className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
        >
          + Add item
        </button>

        {actionData?.ok && (
          <p className="text-sm text-green-600">Menu saved.</p>
        )}

        <button
          type="submit"
          disabled={isSaving}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
        >
          {isSaving ? 'Saving…' : 'Save Menu'}
        </button>
      </Form>

      {menus.length > 0 && (
        <p className="mt-4 text-xs text-gray-500">
          Existing menus:{' '}
          {menus.map((m) => `${m.handle} (${m.itemCount})`).join(', ')}
        </p>
      )}
    </div>
  );
}
