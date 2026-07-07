// GET /api/v1/categories — list categories (public)

import { listCategories } from '#/core/catalog/index.server';
import { parsePublicCategoryListParams } from '#/core/catalog/params';

export async function loader({ request }) {
  const url = new URL(request.url);
  const { locale } = parsePublicCategoryListParams(url);

  const categories = await listCategories({ locale });
  return Response.json({ categories });
}
