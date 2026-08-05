// app/routes/admin/wishlists/index.jsx
// Wishlist items admin list — sticky-header table with search.

import { HeartIcon } from '@heroicons/react/24/outline';
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
import Table, { TBody, Td, Th, THead, Tr } from '#/components/admin/table';
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
    totalPages: Math.ceil(data.total / PAGE_SIZE),
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
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function AdminWishlistsRoute() {
  const t = useT();
  const { items, total, page, totalPages, q } = useLoaderData();
  const [, setSearchParams] = useSearchParams();

  /**
   * @param {number} nextPage
   */
  function goToPage(nextPage) {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.set('page', String(nextPage));
      return params;
    });
  }

  return (
    <div>
      <PageHeader
        title={t('admin.wishlists.index.title')}
        subtitle={t('admin.wishlists.index.subtitle')}
      />

      <Toolbar className="border-border mb-4 rounded-xl border shadow-xs sm:px-4">
        <SearchField
          defaultValue={q}
          placeholder={t('admin.wishlists.index.searchPlaceholder')}
          formClassName="w-full sm:max-w-sm"
        />
        <ToolbarGroup>
          <span className="text-text-muted text-sm">
            {total === 1
              ? t('admin.wishlists.index.resultsOne', { count: total })
              : t('admin.wishlists.index.results', { count: total })}
          </span>
        </ToolbarGroup>
      </Toolbar>

      {items.length === 0 ? (
        <EmptyState
          icon={HeartIcon}
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
        <Table variant="sticky" className="mt-2">
          <THead sticky>
            <tr>
              <Th sticky className="py-3.5 pr-3 pl-1 sm:pl-0">
                {t('admin.wishlists.index.col.product')}
              </Th>
              <Th sticky className="hidden px-3 py-3.5 sm:table-cell">
                {t('admin.wishlists.index.col.variant')}
              </Th>
              <Th sticky className="px-3 py-3.5">
                {t('admin.wishlists.index.col.customer')}
              </Th>
              <Th sticky className="hidden px-3 py-3.5 md:table-cell">
                {t('admin.wishlists.index.col.added')}
              </Th>
              <Th sticky className="py-3.5 pr-1 pl-3 sm:pr-0">
                <span className="sr-only">
                  {t('admin.wishlists.index.col.actions')}
                </span>
              </Th>
            </tr>
          </THead>
          <TBody sticky>
            {items.map((item) => {
              const label = item.productTitle ?? '—';
              const customer = item.customer?.email ?? item.customerId ?? '—';
              return (
                <Tr key={item.id}>
                  <Td
                    sticky
                    className="text-text py-4 pr-3 pl-1 font-medium whitespace-normal sm:pl-0"
                  >
                    <span className="block min-w-0">
                      <span className="block truncate font-medium">
                        {label}
                      </span>
                      <span className="text-text-muted mt-0.5 block truncate font-mono text-xs font-normal">
                        {item.variantSku ?? item.variantId}
                      </span>
                    </span>
                  </Td>
                  <Td
                    sticky
                    className="text-text-muted hidden px-3 py-4 font-mono text-sm sm:table-cell"
                  >
                    {item.variantSku ?? item.variantId}
                  </Td>
                  <Td sticky className="px-3 py-4">
                    {customer}
                  </Td>
                  <Td
                    sticky
                    className="hidden px-3 py-4 tabular-nums md:table-cell"
                  >
                    {formatDate(item.createdAt)}
                  </Td>
                  <Td
                    sticky
                    className="py-4 pr-1 pl-3 text-right text-sm font-medium sm:pr-0"
                  >
                    <Form method="post" className="inline">
                      <input type="hidden" name="intent" value="delete" />
                      <input type="hidden" name="id" value={item.id} />
                      <button
                        type="submit"
                        className="text-danger hover:text-danger/80"
                      >
                        {t('admin.wishlists.index.remove')}
                        <span className="sr-only">, {label}</span>
                      </button>
                    </Form>
                  </Td>
                </Tr>
              );
            })}
          </TBody>
        </Table>
      )}

      <Pagination page={page} totalPages={totalPages} onPageChange={goToPage} />
    </div>
  );
}

export const meta = () => [{ title: 'Wishlists — Admin' }];
