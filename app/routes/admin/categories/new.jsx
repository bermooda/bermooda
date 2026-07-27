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
import CreatePage from '#/components/admin/create-page';

/** @typedef {import('#/components/admin/create-page/spec').CreatePageSpec} CreatePageSpec */

/**
 * Typefaces used by the create-page design candidates. Trim this to the
 * winning design's pair once a candidate is adopted, and move it to
 * `app/root.jsx` when the design ships to every admin create page.
 */
export const links = () => [
  { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
  {
    rel: 'preconnect',
    href: 'https://fonts.gstatic.com',
    crossOrigin: 'anonymous',
  },
  {
    rel: 'stylesheet',
    href: 'https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400..700;1,6..96,400..600&family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Figtree:wght@400;500;600;700&family=Fraunces:ital,opsz,wght@0,9..144,400..700;1,9..144,400..600&family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&family=Karla:wght@400;500;600;700&family=Public+Sans:wght@400;500;600;700&display=swap',
  },
];

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

export default function AdminNewCategoryRoute() {
  const { allForSelect } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();

  /** @type {CreatePageSpec} */
  const spec = {
    eyebrow: 'Catalog',
    title: 'New category',
    subtitle: 'Add a category to organize your product catalog.',
    breadcrumbs: [
      { label: 'Categories', href: '/admin/categories' },
      { label: 'New category' },
    ],
    sections: [
      {
        id: 'details',
        title: 'Category details',
        description:
          'English name and slug. Parent is optional for nested categories.',
        fields: [
          {
            name: 'title',
            label: 'Name (EN)',
            required: true,
            placeholder: 'e.g. Apparel',
          },
          {
            name: 'slug',
            label: 'Slug (EN)',
            placeholder: 'apparel',
            hint: 'Leave empty to add a URL later.',
          },
          {
            name: 'parentId',
            label: 'Parent category',
            type: 'select',
            options: [
              { value: '', label: '— None (root) —' },
              ...allForSelect.map((category) => ({
                value: category.id,
                label: category.title,
              })),
            ],
          },
        ],
      },
    ],
    cancelHref: '/admin/categories',
    submitLabel: 'Create category',
    submittingLabel: 'Creating…',
    error: actionData?.error,
    preview: {
      pathPrefix: '/categories/',
      slugField: 'slug',
      summaryFields: ['title', 'slug', 'parentId'],
    },
  };

  return (
    <CreatePage spec={spec} isSaving={navigation.state === 'submitting'} />
  );
}
