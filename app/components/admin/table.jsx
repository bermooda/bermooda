import clsx from 'clsx';

/**
 * Table
 * Responsive wrapper around a native `<table>`. Provides a contained
 * horizontal scroll on narrow viewports (no full-page overflow) plus
 * consistent surface, border, and divider styling.
 *
 * Compose with the exported `Th` / `Td` helpers, or pass raw `<thead>` /
 * `<tbody>` children for full control.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children `<thead>` / `<tbody>` content
 * @param {string} [props.className] Extra classes on the outer wrapper
 * @returns {React.ReactElement}
 */
export default function Table({ children, className = '' }) {
  return (
    <div
      className={clsx(
        'border-border bg-surface overflow-hidden rounded-xl border shadow-xs',
        className
      )}
    >
      <div className="overflow-x-auto">
        <table className="divide-border min-w-full divide-y">{children}</table>
      </div>
    </div>
  );
}

/**
 * Table header cell.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children
 * @param {string} [props.className]
 * @returns {React.ReactElement}
 */
export function Th({ children, className = '', ...props }) {
  return (
    <th
      scope="col"
      className={clsx(
        'text-text-muted px-4 py-3 text-left text-xs font-medium tracking-wide uppercase',
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
 * @param {string} [props.className]
 * @returns {React.ReactElement}
 */
export function Td({ children, className = '', ...props }) {
  return (
    <td
      className={clsx('text-text-muted px-4 py-3.5 text-sm', className)}
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
 * @returns {React.ReactElement}
 */
export function THead({ children }) {
  return <thead className="bg-surface-2/50">{children}</thead>;
}

/**
 * Styled table body wrapper with row dividers and hover affordance.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children
 * @returns {React.ReactElement}
 */
export function TBody({ children }) {
  return (
    <tbody className="divide-border [&>tr:hover]:bg-surface-2/50 divide-y">
      {children}
    </tbody>
  );
}
