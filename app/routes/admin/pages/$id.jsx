import clsx from 'clsx';
import { useState } from 'react';
import { Form, useActionData, useLoaderData } from 'react-router';
import { redirect } from 'react-router';

import prisma from '#/libs/prisma.server';
import Card from '#/components/admin/card';
import Field from '#/components/admin/form/field';
import Input from '#/components/admin/form/input';
import Select from '#/components/admin/form/select';
import Textarea from '#/components/admin/form/textarea';
import PageHeader from '#/components/admin/page-header';
import { ErrorAlert, SuccessAlert } from '#/components/ui/alert';
import { ButtonSubmit } from '#/components/ui/button';

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
    <div className="border-border flex gap-1 border-b">
      {locales.map((locale) => (
        <button
          key={locale}
          type="button"
          onClick={() => onSelect(locale)}
          className={clsx(
            'px-3 py-2 text-sm font-medium transition-colors',
            active === locale
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

export default function AdminPageEditRoute() {
  const { page, locales, translationMap, slugMap } = useLoaderData();
  const actionData = useActionData();
  const [activeLocale, setActiveLocale] = useState(locales[0] ?? 'en');

  const t = translationMap[activeLocale] ?? {};

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Edit Page"
        actions={
          <Form
            method="post"
            onSubmit={(e) =>
              !confirm('Delete this page?') && e.preventDefault()
            }
          >
            <input type="hidden" name="intent" value="delete" />
            <button
              type="submit"
              className="text-danger text-sm hover:underline"
            >
              Delete
            </button>
          </Form>
        }
        className="mb-6"
      />

      <Card>
        <Form method="post" className="space-y-6">
          <input type="hidden" name="locale" value={activeLocale} />

          <label className="text-text flex items-center gap-2 text-sm">
            <span className="font-medium">Status</span>
            <Select name="status" defaultValue={page.status} className="w-auto">
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </Select>
          </label>

          <LocaleTabs
            locales={locales}
            active={activeLocale}
            onSelect={setActiveLocale}
          />

          <div className="space-y-4">
            <Field label="Title">
              <Input name="title" type="text" defaultValue={t.title ?? ''} />
            </Field>
            <Field label="Slug">
              <Input
                name="slug"
                type="text"
                defaultValue={slugMap[activeLocale] ?? ''}
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              />
            </Field>
            <Field label="Body">
              <Textarea name="body" rows={10} defaultValue={t.body ?? ''} />
            </Field>
            <Field label="Meta title">
              <Input
                name="metaTitle"
                type="text"
                defaultValue={t.metaTitle ?? ''}
              />
            </Field>
            <Field label="Meta description">
              <Textarea
                name="metaDescription"
                rows={2}
                defaultValue={t.metaDescription ?? ''}
              />
            </Field>
          </div>

          <ErrorAlert message={actionData?.error} />
          {actionData?.ok && <SuccessAlert message="Saved." />}

          <ButtonSubmit>Save Page</ButtonSubmit>
        </Form>
      </Card>
    </div>
  );
}
