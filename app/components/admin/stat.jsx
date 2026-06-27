import clsx from 'clsx';

/**
 * Stat
 * Compact metric pill for list page summaries.
 *
 * @param {Object} props
 * @param {string} props.label
 * @param {React.ReactNode} props.value
 * @param {string} [props.className]
 * @returns {React.ReactElement}
 */
export default function Stat({ label, value, className = '' }) {
  return (
    <div
      className={clsx(
        'border-border bg-surface rounded-lg border px-4 py-3',
        className
      )}
    >
      <p className="text-text-muted text-xs font-medium tracking-wide uppercase">
        {label}
      </p>
      <p className="text-text mt-1 text-2xl font-semibold tracking-tight tabular-nums">
        {value}
      </p>
    </div>
  );
}
