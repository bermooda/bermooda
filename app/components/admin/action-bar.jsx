import clsx from 'clsx';

/**
 * ActionBar
 * Sticky footer for editor pages — save, publish, and destructive actions.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children
 * @param {string} [props.className]
 * @returns {React.ReactElement}
 */
export default function ActionBar({ children, className = '' }) {
  return (
    <div
      className={clsx(
        'border-border bg-surface/95 supports-[backdrop-filter]:bg-surface/80 sticky bottom-0 z-10 -mx-4 mt-8 border-t px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6',
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        {children}
      </div>
    </div>
  );
}
