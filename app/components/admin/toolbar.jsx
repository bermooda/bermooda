import clsx from 'clsx';

/**
 * Toolbar
 * Unified filter/search bar for admin list pages. Sits above tables or card lists.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children
 * @param {string} [props.className]
 * @returns {React.ReactElement}
 */
export default function Toolbar({ children, className = '' }) {
  return (
    <div
      className={clsx(
        'bg-surface flex flex-col gap-3 rounded-t-xl px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:pl-3 sm:pr-5',
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * ToolbarGroup
 * Groups related controls inside a Toolbar.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children
 * @param {string} [props.className]
 * @returns {React.ReactElement}
 */
export function ToolbarGroup({ children, className = '' }) {
  return (
    <div className={clsx('flex flex-wrap items-center gap-2', className)}>
      {children}
    </div>
  );
}
