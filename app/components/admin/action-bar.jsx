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
        'border-border bg-surface/95 supports-[backdrop-filter]:bg-surface/80 sticky -bottom-4 z-10 -mb-4 mt-8 w-full rounded-t-xl border-x border-t px-6 py-4 backdrop-blur md:-bottom-6 md:-mb-6',
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        {children}
      </div>
    </div>
  );
}
