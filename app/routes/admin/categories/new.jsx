import {
  redirect,
  useActionData,
  useLoaderData,
  useNavigation,
} from 'react-router';

import { handleAdminActionError } from '#/libs/api/admin-ui/index.server';
import {
  createCategoryFromAdminInput,
  loadCategoryAdminSelectOptions,
  parseCategoryCreateInput,
} from '#/core/catalog/admin/index.server';
import CategoryEditor from '#/components/admin/category-editor';

export async function loader() {
  return loadCategoryAdminSelectOptions();
}

export async function action({ request }) {
  const formData = await request.formData();
  const parsed = parseCategoryCreateInput(formData);

  if (parsed.error) {
    return { error: parsed.error };
  }

  try {
    await createCategoryFromAdminInput(parsed.data);
    return redirect('/admin/categories');
  } catch (err) {
    return handleAdminActionError(err, {
      source: 'admin.categories.create',
      shape: 'error',
      userMessage: 'Could not create category.',
    });
  }
}

export function meta() {
  return [{ title: 'New category' }];
}

export default function AdminNewCategoryRoute() {
  const { allForSelect } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSaving = navigation.state === 'submitting';

  return (
    <CategoryEditor
      mode="create"
      allForSelect={allForSelect}
      actionData={actionData}
      isSaving={isSaving}
    />
  );
}
