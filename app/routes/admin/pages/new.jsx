import { useActionData, useNavigation } from 'react-router';
import { redirect } from 'react-router';

import { createPage } from '#/core/content/index.server';
import PageEditor from '#/components/admin/page-editor';

export async function action({ request }) {
  const formData = await request.formData();
  const slug = formData.get('slug')?.toString().trim();
  const title = formData.get('title')?.toString().trim();

  if (!slug) return { error: 'Slug is required.' };
  if (!title) return { error: 'Title is required.' };

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return {
      error: 'Slug must be lowercase letters, numbers and hyphens only.',
    };
  }

  try {
    const page = await createPage({
      slug,
      locale: 'en',
      translations: { title },
    });
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
