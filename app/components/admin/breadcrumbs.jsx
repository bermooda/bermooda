import { ChevronRightIcon } from '@heroicons/react/20/solid';
import clsx from 'clsx';
import { Link } from 'react-router';

/**
 * Breadcrumbs
 * Compact trail for admin detail and nested pages.
 *
 * @param {Object} props
 * @param {{ label: string, href?: string }[]} props.items
 * @param {string} [props.className]
 * @returns {React.ReactElement}
 */
export default function Breadcrumbs({ items, className = '' }) {
  return (
    <nav aria-label="Breadcrumb" className={clsx('mb-3', className)}>
      <ol className="text-text-muted flex flex-wrap items-center gap-1.5 text-sm">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <li
              key={`${item.label}-${index}`}
              className="flex items-center gap-1.5"
            >
              {index > 0 && (
                <ChevronRightIcon
                  className="text-text-muted/60 h-3.5 w-3.5 shrink-0"
                  aria-hidden="true"
                />
              )}
              {item.href && !isLast ? (
                <Link
                  to={item.href}
                  className="hover:text-text transition-colors"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className={clsx(isLast && 'text-text font-medium')}
                  aria-current={isLast ? 'page' : undefined}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
