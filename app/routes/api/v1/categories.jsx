// GET /api/v1/categories — list categories (public)

import { listCategories } from '#/core/catalog/index.server';

export async function loader({ request }) {
  const url = new URL(request.url);
  const locale = url.searchParams.get('locale') ?? 'en';

  const categories = await listCategories({ locale });
  return Response.json({ categories });
}
