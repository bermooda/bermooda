import {
  redirect,
  useActionData,
  useLoaderData,
  useNavigation,
} from 'react-router';

import { handleAdminActionError } from '#/libs/api/admin-ui/index.server';
import {
  loadCategoryAdminEditData,
  saveCategoryAdminForm,
} from '#/core/catalog/admin/index.server';
import CategoryEditor from '#/components/admin/category-editor';

export async function loader({ params }) {
  const data = await loadCategoryAdminEditData(params.id);
  if (!data) {
    throw new Response('Category not found', { status: 404 });
  }
  return data;
}

export async function action({ request, params }) {
  const formData = await request.formData();

  try {
    await saveCategoryAdminForm(params.id, formData);
    return redirect('/admin/categories');
  } catch (err) {
    return handleAdminActionError(err, {
      source: 'admin.categories.edit',
      shape: 'error',
      userMessage: 'Could not save category.',
    });
  }
}

export function meta({ loaderData }) {
  const title = loaderData?.category?.enTitle || 'Edit category';
  return [{ title: `${title} — Categories` }];
}

export default function AdminEditCategoryRoute() {
  const { category, locales } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSaving = navigation.state === 'submitting';

  return (
    <CategoryEditor
      mode="edit"
      category={category}
      locales={locales}
      actionData={actionData}
      isSaving={isSaving}
    />
  );
}
