import clsx from 'clsx';

/**
 * Card
 * Neutral surface container with a hairline border. The default building
 * block for admin content panels.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children
 * @param {string} [props.className] Extra classes
 * @param {boolean} [props.padded=true] Apply default inner padding
 * @returns {React.ReactElement}
 */
export default function Card({ children, className = '', padded = true }) {
  return (
    <div
      className={clsx(
        'border-border bg-surface rounded-xl border shadow-xs',
        padded && 'p-4 sm:p-6',
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * CardSection
 * A divided section inside a Card, separated by a hairline top border.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children
 * @param {string} [props.className] Extra classes
 * @returns {React.ReactElement}
 */
export function CardSection({ children, className = '' }) {
  return (
    <div className={clsx('border-border border-t p-4 sm:p-6', className)}>
      {children}
    </div>
  );
}

/**
 * CardHeader
 * Optional top block inside a Card with title, description, and actions.
 *
 * @param {Object} props
 * @param {React.ReactNode} [props.title]
 * @param {React.ReactNode} [props.description]
 * @param {React.ReactNode} [props.action]
 * @param {string} [props.className]
 * @returns {React.ReactElement|null}
 */
export function CardHeader({ title, description, action, className = '' }) {
  if (!title && !description && !action) return null;

  return (
    <div
      className={clsx(
        'mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between',
        className
      )}
    >
      <div className="min-w-0">
        {title && (
          <h2 className="text-text text-sm font-semibold tracking-tight">
            {title}
          </h2>
        )}
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
