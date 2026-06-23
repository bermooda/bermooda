import clsx from 'clsx';

/**
 * PageHeader
 * Ghost-style page top: title + optional subtitle with an actions slot.
 * Stacks vertically on mobile and becomes a row on `sm+`.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.title Page title
 * @param {React.ReactNode} [props.subtitle] Optional supporting text
 * @param {React.ReactNode} [props.actions] Right-aligned actions (buttons, etc.)
 * @param {string} [props.className] Extra classes
 * @returns {React.ReactElement}
 */
export default function PageHeader({
  title,
  subtitle,
  actions,
  className = '',
}) {
  return (
    <div
      className={clsx(
        'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between',
        className
      )}
    >
      <div className="min-w-0">
        <h1 className="text-text truncate text-2xl font-bold tracking-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="text-text-muted mt-1 text-sm">{subtitle}</p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      )}
    </div>
  );
}
