// app/routes/admin/wishlists/index.jsx
// Wishlist items admin UI.

import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { Form, useLoaderData, useSearchParams } from 'react-router';

import {
  deleteWishlistItem,
  loadWishlistAdminIndexData,
  parseDeleteWishlistItemFromForm,
} from '#/core/wishlists/index.server';
import EmptyState from '#/components/admin/empty-state';
import { controlClasses } from '#/components/admin/form/input';
import PageHeader from '#/components/admin/page-header';
import Pagination from '#/components/admin/pagination';
import Table, { Th, Td, THead, TBody } from '#/components/admin/table';
import Toolbar, { ToolbarGroup } from '#/components/admin/toolbar';

const PAGE_SIZE = 20;

export async function loader({ request }) {
  const data = await loadWishlistAdminIndexData({
    request,
    pageSize: PAGE_SIZE,
  });
  const url = new URL(request.url);

  return {
    ...data,
    pageSize: PAGE_SIZE,
    q: url.searchParams.get('q')?.trim() ?? '',
  };
}

export async function action({ request }) {
  const formData = await request.formData();

  try {
    const { id } = parseDeleteWishlistItemFromForm(formData);
    await deleteWishlistItem(id);
    return { ok: true };
  } catch (err) {
    return { error: err.message ?? 'Could not remove wishlist item.' };
  }
}

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

export default function AdminWishlistsRoute() {
  const { items, total, page, pageSize, q } = useLoaderData();
  const [searchParams, setSearchParams] = useSearchParams();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function goToPage(nextPage) {
    const params = new URLSearchParams(searchParams);
    params.set('page', String(nextPage));
    setSearchParams(params);
  }

  return (
    <div>
      <PageHeader
        title="Wishlists"
        subtitle="Saved products across customer wishlists."
        className="mb-6"
      />

      <Toolbar className="mb-4">
        <ToolbarGroup>
          <Form method="get" className="relative">
            <MagnifyingGlassIcon className="text-text-muted pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Search by email or SKU…"
              className={`${controlClasses} w-72 pl-9`}
            />
          </Form>
        </ToolbarGroup>
      </Toolbar>

      <h2 className="text-text mb-3 text-lg font-semibold">Items ({total})</h2>

      {items.length === 0 ? (
        <EmptyState
          title={
            q ? 'No wishlist items match your search' : 'No wishlist items yet'
          }
          description={
            q
              ? 'Try a different email, SKU, or clear the search.'
              : 'Customers can save products from product pages when signed in.'
          }
        />
      ) : (
        <>
          <Table>
            <THead>
              <tr>
                <Th>Product</Th>
                <Th>Variant</Th>
                <Th>Customer</Th>
                <Th>Added</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </THead>
            <TBody>
              {items.map((item) => (
                <tr key={item.id}>
                  <Td>{item.productTitle ?? '—'}</Td>
                  <Td>{item.variantSku ?? item.variantId}</Td>
                  <Td>{item.customer?.email ?? item.customerId ?? '—'}</Td>
                  <Td>{formatDate(item.createdAt)}</Td>
                  <Td className="text-right">
                    <Form method="post" className="inline">
                      <input type="hidden" name="intent" value="delete" />
                      <input type="hidden" name="id" value={item.id} />
                      <button
                        type="submit"
                        className="text-danger text-sm hover:underline"
                      >
                        Remove
                      </button>
                    </Form>
                  </Td>
                </tr>
              ))}
            </TBody>
          </Table>

          <Pagination
            page={page}
            totalPages={totalPages}
            className="mt-6"
            onPageChange={goToPage}
          />
        </>
      )}
    </div>
  );
}

export const meta = () => [{ title: 'Wishlists — Admin' }];
