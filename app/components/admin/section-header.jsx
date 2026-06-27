import clsx from 'clsx';

/**
 * SectionHeader
 * Consistent heading block for admin cards and panels.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.title
 * @param {React.ReactNode} [props.description]
 * @param {React.ReactNode} [props.action]
 * @param {string} [props.className]
 * @returns {React.ReactElement}
 */
export default function SectionHeader({
  title,
  description,
  action,
  className = '',
}) {
  return (
    <div
      className={clsx(
        'mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between',
        className
      )}
    >
      <div className="min-w-0">
        <h2 className="text-text text-sm font-semibold tracking-tight">
          {title}
        </h2>
        {description && (
          <p className="text-text-muted mt-1 text-sm leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {action && (
        <div className="flex shrink-0 items-center gap-2">{action}</div>
      )}
    </div>
  );
}
