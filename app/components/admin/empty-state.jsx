import clsx from 'clsx';

/**
 * EmptyState
 * Consistent zero-data state for lists and panels.
 *
 * @param {Object} props
 * @param {React.ElementType} [props.icon] Heroicon component
 * @param {React.ReactNode} props.title Headline
 * @param {React.ReactNode} [props.description] Supporting text
 * @param {React.ReactNode} [props.action] Optional CTA (button/link)
 * @param {string} [props.className] Extra classes
 * @returns {React.ReactElement}
 */
export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className = '',
}) {
  return (
    <div
      className={clsx(
        'border-border bg-surface flex flex-col items-center rounded-xl border px-6 py-12 text-center',
        className
      )}
    >
      {Icon && (
        <span className="bg-surface-2 text-text-muted mb-4 flex h-12 w-12 items-center justify-center rounded-full">
          <Icon className="h-6 w-6" aria-hidden="true" />
        </span>
      )}
      <h3 className="text-text text-sm font-semibold">{title}</h3>
      {description && (
        <p className="text-text-muted mt-1 max-w-sm text-sm">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
