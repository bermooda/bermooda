import { useActionData, useNavigation } from 'react-router';
import { redirect } from 'react-router';

import { createPage, parseCreatePageInput } from '#/core/content/index.server';
import PageEditor from '#/components/admin/page-editor';

export async function action({ request }) {
  const formData = await request.formData();

  try {
    const input = parseCreatePageInput({
      slug: formData.get('slug')?.toString().trim(),
      locale: 'en',
      translations: { title: formData.get('title')?.toString().trim() },
    });
    const page = await createPage(input);
    return redirect(`/admin/pages/${page.id}`);
  } catch (err) {
    return { error: err.message ?? 'Failed to create page.' };
  }
}

export default function AdminNewPageRoute() {
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSaving = navigation.state === 'submitting';

  return (
    <PageEditor
      mode="create"
      page={{ status: 'draft' }}
      locales={['en']}
      translationMap={{}}
      slugMap={{}}
      actionData={actionData}
      isSaving={isSaving}
    />
  );
}
