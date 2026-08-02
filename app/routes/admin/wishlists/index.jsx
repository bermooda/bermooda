// app/routes/admin/wishlists/index.jsx
// Wishlist items admin UI.

import { Form, useLoaderData, useSearchParams } from 'react-router';

import { useT } from '#/core/i18n';
import {
  deleteWishlistItem,
  loadWishlistAdminIndexData,
  parseDeleteWishlistItemFromForm,
} from '#/core/wishlists/index.server';
import EmptyState from '#/components/admin/empty-state';
import PageHeader from '#/components/admin/page-header';
import Pagination from '#/components/admin/pagination';
import SearchField from '#/components/admin/search-field';
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

/**
 * @param {string | Date | null | undefined} value
 * @returns {string}
 */
function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

export default function AdminWishlistsRoute() {
  const t = useT();
  const { items, total, page, pageSize, q } = useLoaderData();
  const [searchParams, setSearchParams] = useSearchParams();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  /**
   * @param {number} nextPage
   */
  function goToPage(nextPage) {
    const params = new URLSearchParams(searchParams);
    params.set('page', String(nextPage));
    setSearchParams(params);
  }

  return (
    <div>
      <PageHeader
        title={t('admin.wishlists.index.title')}
        subtitle={t('admin.wishlists.index.subtitle')}
        className="mb-6"
      />

      <Toolbar className="mb-4">
        <ToolbarGroup>
          <SearchField
            defaultValue={q}
            placeholder={t('admin.wishlists.index.searchPlaceholder')}
            className="w-72"
          />
        </ToolbarGroup>
      </Toolbar>

      <h2 className="text-text mb-3 text-lg font-semibold">
        {t('admin.wishlists.index.items', { total })}
      </h2>

      {items.length === 0 ? (
        <EmptyState
          title={
            q
              ? t('admin.wishlists.index.emptyTitleSearch')
              : t('admin.wishlists.index.emptyTitle')
          }
          description={
            q
              ? t('admin.wishlists.index.emptyDescriptionSearch')
              : t('admin.wishlists.index.emptyDescription')
          }
        />
      ) : (
        <>
          <Table>
            <THead>
              <tr>
                <Th>{t('admin.wishlists.index.col.product')}</Th>
                <Th>{t('admin.wishlists.index.col.variant')}</Th>
                <Th>{t('admin.wishlists.index.col.customer')}</Th>
                <Th>{t('admin.wishlists.index.col.added')}</Th>
                <Th className="text-right">
                  {t('admin.wishlists.index.col.actions')}
                </Th>
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
                        {t('admin.wishlists.index.remove')}
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
