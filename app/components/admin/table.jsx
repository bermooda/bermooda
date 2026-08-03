import clsx from 'clsx';

/**
 * Table
 * Responsive wrapper around a native `<table>`.
 *
 * - `default` — contained surface with border, shadow, and horizontal scroll.
 * - `sticky` — Tailwind Plus “with sticky header” layout: full-bleed bleed
 *   margins, `border-separate` / `border-spacing-0`, frosted sticky headers.
 *   Pair with `sticky` on `Th` / `Td` / `THead` / `TBody`.
 *
 * Compose with the exported `Th` / `Td` helpers, or pass raw `<thead>` /
 * `<tbody>` children for full control.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children `<thead>` / `<tbody>` content
 * @param {'default' | 'sticky'} [props.variant='default']
 * @param {string} [props.className] Extra classes on the outer wrapper
 * @returns {React.ReactElement}
 */
export default function Table({
  children,
  variant = 'default',
  className = '',
}) {
  if (variant === 'sticky') {
    // No overflow-x wrapper: non-visible overflow on an ancestor breaks
    // position:sticky relative to the admin main scrollport.
    return (
      <div className={clsx('flow-root', className)}>
        <div className="-mx-4 -my-2 md:-mx-6">
          <div className="inline-block min-w-full py-2 align-middle">
            <table className="min-w-full border-separate border-spacing-0">
              {children}
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={clsx(
        'border-border bg-surface overflow-hidden border shadow-xs',
        className
      )}
    >
      <div className="overflow-x-auto">
        <table className="divide-border w-max min-w-full divide-y">
          {children}
        </table>
      </div>
    </div>
  );
}

/**
 * Table header cell.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children
 * @param {boolean} [props.sticky=false] Sticky frosted header (Plus sticky table)
 * @param {string} [props.className]
 * @returns {React.ReactElement}
 */
export function Th({ children, sticky = false, className = '', ...props }) {
  return (
    <th
      scope="col"
      className={clsx(
        sticky
          ? 'text-text border-border bg-surface/75 sticky top-0 z-10 border-b py-3.5 text-left text-sm font-semibold backdrop-blur backdrop-filter'
          : 'text-text-muted px-4 py-3 text-left text-xs font-medium tracking-wide uppercase',
        className
      )}
      {...props}
    >
      {children}
    </th>
  );
}

/**
 * Table body cell.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children
 * @param {boolean} [props.sticky=false] Border-per-cell style for sticky tables
 * @param {string} [props.className]
 * @returns {React.ReactElement}
 */
export function Td({ children, sticky = false, className = '', ...props }) {
  return (
    <td
      className={clsx(
        sticky
          ? 'text-text-muted border-border border-b px-3 py-4 text-sm whitespace-nowrap'
          : 'text-text-muted px-4 py-3.5 text-sm',
        className
      )}
      {...props}
    >
      {children}
    </td>
  );
}

/**
 * Clickable table row with hover affordance.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children
 * @param {string} [props.className]
 * @returns {React.ReactElement}
 */
export function Tr({ children, className = '', ...props }) {
  return (
    <tr
      className={clsx('hover:bg-surface-2/60 transition-colors', className)}
      {...props}
    >
      {children}
    </tr>
  );
}

/**
 * Styled table head wrapper.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children
 * @param {boolean} [props.sticky=false]
 * @param {string} [props.className]
 * @returns {React.ReactElement}
 */
export function THead({ children, sticky = false, className = '' }) {
  return (
    <thead className={clsx(sticky ? undefined : 'bg-surface-2/50', className)}>
      {children}
    </thead>
  );
}

/**
 * Styled table body wrapper with row dividers and hover affordance.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children
 * @param {boolean} [props.sticky=false] Skip divide-y; cells own borders
 * @param {string} [props.className]
 * @returns {React.ReactElement}
 */
export function TBody({ children, sticky = false, className = '' }) {
  return (
    <tbody
      className={clsx(
        sticky
          ? '[&>tr:hover]:bg-surface-2/50'
          : 'divide-border [&>tr:hover]:bg-surface-2/50 divide-y',
        className
      )}
    >
      {children}
    </tbody>
  );
}
