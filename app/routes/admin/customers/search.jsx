// GET /admin/customers/search — JSON customer typeahead for admin comboboxes

import { authenticate } from '#/libs/auth/admin/index.server';
import { listCustomers } from '#/core/customers/index.server';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

/**
 * @typedef {{ id: string, email: string, name?: string | null }} CustomerSearchRow
 */

/**
 * Lazy customer search for admin member pickers.
 *
 * Query params: `q`, `limit`, repeated `exclude` (customer ids to omit).
 *
 * @param {{ request: Request }} args
 * @returns {Promise<Response>}
 */
export async function loader({ request }) {
  await authenticate(request);

  const url = new URL(request.url);
  const q = url.searchParams.get('q')?.trim() || undefined;
  const exclude = new Set(
    url.searchParams.getAll('exclude').filter((id) => Boolean(id))
  );
  const rawLimit = Number.parseInt(url.searchParams.get('limit') ?? '', 10);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(rawLimit, 1), MAX_LIMIT)
    : DEFAULT_LIMIT;

  // Over-fetch when excluding so the visible page stays useful.
  const fetchLimit =
    exclude.size > 0 ? Math.min(limit + exclude.size, MAX_LIMIT) : limit;
  const { customers } = await listCustomers({ page: 1, limit: fetchLimit, q });

  /** @type {CustomerSearchRow[]} */
  const items = customers
    .filter(
      (/** @type {CustomerSearchRow} */ customer) => !exclude.has(customer.id)
    )
    .slice(0, limit)
    .map((/** @type {CustomerSearchRow} */ customer) => ({
      id: customer.id,
      email: customer.email,
      name: customer.name ?? null,
    }));

  return Response.json({ customers: items });
}
