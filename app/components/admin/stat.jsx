import clsx from 'clsx';

/**
 * Stat
 * Compact metric tile for dashboards and list page summaries.
 *
 * @param {Object} props
 * @param {string} props.label
 * @param {React.ReactNode} props.value
 * @param {React.ReactNode} [props.hint] Optional supporting line under the value
 * @param {React.ElementType} [props.icon] Optional Heroicon shown beside the label
 * @param {string} [props.className]
 * @returns {React.ReactElement}
 */
export default function Stat({
  label,
  value,
  hint,
  icon: Icon,
  className = '',
}) {
  return (
    <div
      className={clsx(
        'border-border bg-surface rounded-xl border px-4 py-3 shadow-xs',
        className
      )}
    >
      <p className="text-text-muted flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase">
        {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />}
        <span className="truncate">{label}</span>
      </p>
      <p className="text-text mt-1 text-2xl font-semibold tracking-tight tabular-nums">
        {value}
      </p>
      {hint && <p className="text-text-muted mt-0.5 text-xs">{hint}</p>}
    </div>
  );
}
