import clsx from 'clsx';
import { useState } from 'react';
import { Form, useActionData, useLoaderData } from 'react-router';

import prisma from '#/libs/prisma.server';
import Card from '#/components/admin/card';
import Field from '#/components/admin/form/field';
import Input from '#/components/admin/form/input';
import Select from '#/components/admin/form/select';
import PageHeader from '#/components/admin/page-header';
import { SuccessAlert } from '#/components/ui/alert';
import { ButtonSubmit } from '#/components/ui/button';

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
  const [items, setItems] = useState(menu?.items ?? []);

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
      <PageHeader
        title="Menus"
        subtitle="Edit navigation menus used in the storefront theme."
        className="mb-6"
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {MENU_HANDLES.map((h) => (
          <a
            key={h}
            href={`?handle=${h}`}
            className={clsx(
              'rounded-full px-3 py-1 text-sm font-medium capitalize transition-colors',
              handle === h
                ? 'bg-accent text-accent-fg'
                : 'bg-surface-2 text-text-muted hover:text-text'
            )}
          >
            {h}
          </a>
        ))}
      </div>

      <Card>
        <Form method="post" className="space-y-4">
          <input type="hidden" name="handle" value={handle} />
          <input type="hidden" name="itemCount" value={items.length} />

          <Field label="Menu title" className="max-w-md">
            <Input
              name="title"
              type="text"
              defaultValue={menu?.title ?? handle}
            />
          </Field>

          <div className="space-y-3">
            {items.map((item, index) => (
              <div
                key={index}
                className="border-border grid gap-3 rounded-md border p-4 md:grid-cols-2"
              >
                <input
                  type="hidden"
                  name={`items[${index}][position]`}
                  value={index}
                />
                <Field label="Label">
                  <Input
                    name={`items[${index}][label]`}
                    value={item.label}
                    onChange={(e) => updateItem(index, 'label', e.target.value)}
                  />
                </Field>
                <Field label="Custom URL">
                  <Input
                    name={`items[${index}][url]`}
                    value={item.url ?? ''}
                    onChange={(e) => updateItem(index, 'url', e.target.value)}
                    placeholder="/about"
                  />
                </Field>
                <Field label="Link to page">
                  <Select
                    name={`items[${index}][pageId]`}
                    value={item.pageId ?? ''}
                    onChange={(e) =>
                      updateItem(index, 'pageId', e.target.value)
                    }
                  >
                    <option value="">—</option>
                    {pages.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Link to category">
                  <Select
                    name={`items[${index}][categoryId]`}
                    value={item.categoryId ?? ''}
                    onChange={(e) =>
                      updateItem(index, 'categoryId', e.target.value)
                    }
                  >
                    <option value="">—</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </Select>
                </Field>
                <div className="flex items-end justify-between md:col-span-2">
                  <label className="text-text flex items-center gap-2 text-sm">
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
                    className="text-danger text-sm hover:underline"
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
            className="text-accent text-sm font-medium hover:underline"
          >
            + Add item
          </button>

          {actionData?.ok && <SuccessAlert message="Menu saved." />}

          <div>
            <ButtonSubmit>Save Menu</ButtonSubmit>
          </div>
        </Form>
      </Card>

      {menus.length > 0 && (
        <p className="text-text-muted mt-4 text-xs">
          Existing menus:{' '}
          {menus.map((m) => `${m.handle} (${m.itemCount})`).join(', ')}
        </p>
      )}
    </div>
  );
}
