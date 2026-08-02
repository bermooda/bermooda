import { useT } from '#/core/i18n';
import Button from '#/components/ui/button';

/**
 * Pagination
 * Page indicator with Previous/Next controls for admin list pages.
 *
 * @param {Object} props
 * @param {number} props.page Current page (1-indexed)
 * @param {number} props.totalPages Total number of pages
 * @param {(page: number) => void} props.onPageChange Called with the target page
 * @param {string} [props.className] Extra classes on the wrapper
 * @returns {React.ReactElement|null}
 */
export default function Pagination({
  page,
  totalPages,
  onPageChange,
  className = '',
}) {
  const t = useT();

  if (totalPages <= 1) return null;

  return (
    <div
      className={`text-text-muted mt-4 flex items-center justify-between gap-3 text-sm ${className}`}
    >
      <span>{t('admin.pagination.pageOf', { page, totalPages })}</span>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          {t('admin.pagination.previous')}
        </Button>
        <Button
          variant="secondary"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          {t('admin.pagination.next')}
        </Button>
      </div>
    </div>
  );
}
