import clsx from 'clsx';
import { useState } from 'react';
import { Form, useActionData, useLoaderData } from 'react-router';

import {
  loadMenuEditorData,
  parseMenuFormInput,
  upsertMenu,
} from '#/core/content/index.server';
import { useT } from '#/core/i18n';
import Card from '#/components/admin/card';
import Field from '#/components/admin/form/field';
import Input from '#/components/admin/form/input';
import Select from '#/components/admin/form/select';
import PageHeader from '#/components/admin/page-header';
import SortableList, { SortableGrip } from '#/components/admin/sortable-list';
import { SuccessAlert } from '#/components/ui/alert';
import { ButtonSubmit } from '#/components/ui/button';

export async function loader({ request }) {
  const url = new URL(request.url);
  const handle = url.searchParams.get('handle') || 'main';
  return loadMenuEditorData(handle);
}

export async function action({ request }) {
  const formData = await request.formData();
  const { handle, title, items } = parseMenuFormInput(formData);
  await upsertMenu(handle, { title, items });
  return { ok: true, handle };
}

export default function AdminMenusRoute() {
  const t = useT();
  const { handle, menus, menu, menuHandles, pages, categories } =
    useLoaderData();
  const actionData = useActionData();
  const [items, setItems] = useState(
    (menu?.items ?? []).map((item, index) => ({
      ...item,
      clientId: item.clientId ?? `item-${index}`,
    }))
  );

  function addItem() {
    setItems((prev) => [
      ...prev,
      {
        clientId: `item-${Date.now()}`,
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
    setItems((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((item, position) => ({ ...item, position }))
    );
  }

  function reorderItems(nextItems) {
    setItems(nextItems.map((item, position) => ({ ...item, position })));
  }

  function updateItem(index, field, value) {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={t('admin.menus.index.title')}
        subtitle={t('admin.menus.index.subtitle')}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {menuHandles.map((h) => (
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

          <Field label={t('admin.menus.index.menuTitle')} className="max-w-md">
            <Input
              name="title"
              type="text"
              defaultValue={menu?.title ?? handle}
            />
          </Field>

          <SortableList
            items={items}
            getId={(item) => item.clientId}
            className="space-y-3"
            itemClassName="list-none"
            onReorder={reorderItems}
            renderItem={(item, index, { handleRef }) => (
              <div className="border-border grid gap-3 rounded-md border p-4 md:grid-cols-2">
                <div className="flex items-start md:col-span-2">
                  <SortableGrip
                    handleRef={handleRef}
                    className="mr-2 shrink-0"
                  />
                  <span className="text-text-muted text-xs font-medium">
                    {t('admin.menus.index.itemLabel', { index: index + 1 })}
                  </span>
                </div>
                <input
                  type="hidden"
                  name={`items[${index}][position]`}
                  value={index}
                />
                <Field label={t('admin.menus.index.label')}>
                  <Input
                    name={`items[${index}][label]`}
                    value={item.label}
                    onChange={(e) => updateItem(index, 'label', e.target.value)}
                  />
                </Field>
                <Field label={t('admin.menus.index.customUrl')}>
                  <Input
                    name={`items[${index}][url]`}
                    value={item.url ?? ''}
                    onChange={(e) => updateItem(index, 'url', e.target.value)}
                    placeholder={t('admin.menus.index.urlPlaceholder')}
                  />
                </Field>
                <Field label={t('admin.menus.index.linkToPage')}>
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
                <Field label={t('admin.menus.index.linkToCategory')}>
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
                    {t('admin.menus.index.openInNewTab')}
                  </label>
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    className="text-danger text-sm hover:underline"
                  >
                    {t('admin.menus.index.remove')}
                  </button>
                </div>
              </div>
            )}
          />

          <button
            type="button"
            onClick={addItem}
            className="text-accent text-sm font-medium hover:underline"
          >
            {t('admin.menus.index.addItem')}
          </button>

          {actionData?.ok && (
            <SuccessAlert message={t('admin.menus.index.saved')} />
          )}

          <div>
            <ButtonSubmit>{t('admin.menus.index.save')}</ButtonSubmit>
          </div>
        </Form>
      </Card>

      {menus.length > 0 && (
        <p className="text-text-muted mt-4 text-xs">
          {t('admin.menus.index.existingMenus', {
            list: menus.map((m) => `${m.handle} (${m.itemCount})`).join(', '),
          })}
        </p>
      )}
    </div>
  );
}
