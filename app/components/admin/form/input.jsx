import clsx from 'clsx';

/**
 * Shared control classes for admin form fields. A flat surface with a
 * hairline border and a single accent focus ring.
 */
export const controlClasses =
  'bg-surface text-text border-border placeholder:text-text-muted/70 block w-full rounded-md border px-3 py-1.5 text-sm shadow-xs outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-60';

/**
 * Input
 * Text input with a consistent accent focus ring.
 *
 * @param {Object} props
 * @param {string} [props.className] Extra classes
 * @returns {React.ReactElement}
 */
export default function Input({ className = '', ...props }) {
  return <input className={clsx(controlClasses, className)} {...props} />;
}
