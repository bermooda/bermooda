import { useActionData, useLoaderData, useNavigation } from 'react-router';
import { redirect } from 'react-router';

import {
  deletePage,
  loadPageEditorData,
  parsePageFormInput,
  updatePage,
} from '#/core/content/index.server';
import PageEditor from '#/components/admin/page-editor';

export async function loader({ params }) {
  try {
    return await loadPageEditorData(params.id);
  } catch (err) {
    if (err.code === 'NOT_FOUND') {
      throw new Response('Page not found', { status: 404 });
    }
    throw err;
  }
}

export async function action({ request, params }) {
  const formData = await request.formData();

  try {
    const input = parsePageFormInput(formData);
    if (input.intent === 'delete') {
      await deletePage(params.id);
      return redirect('/admin/pages');
    }

    await updatePage(params.id, input);
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
