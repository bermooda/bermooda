import clsx from 'clsx';

const controlBase =
  'bg-surface text-text border-border placeholder:text-text-muted/70 block rounded-md border px-3 py-1.5 text-sm shadow-xs outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-60';

/**
 * Shared control classes for admin form fields. A flat surface with a
 * hairline border and a single accent focus ring. Full width by default.
 */
export const controlClasses = clsx(controlBase, 'w-full');

/** Matches an unprefixed width utility such as `w-24` or `w-auto`. */
const WIDTH_UTILITY = /(^|\s)w-\S+/;

/**
 * Build control classes, keeping `w-full` only when `extra` does not set its
 * own base width. Without tailwind-merge, `w-full` would otherwise win over
 * `w-24` / `w-auto` and silently ignore the override.
 *
 * @param {...(string|false|null|undefined)} extra
 * @returns {string}
 */
export function controlClassName(...extra) {
  const rest = clsx(...extra);
  return clsx(controlBase, !WIDTH_UTILITY.test(rest) && 'w-full', rest);
}

/**
 * Input
 * Text input with a consistent accent focus ring.
 *
 * @param {Object} props
 * @param {string} [props.className] Extra classes
 * @returns {React.ReactElement}
 */
export default function Input({ className = '', ...props }) {
  return <input className={controlClassName(className)} {...props} />;
}
