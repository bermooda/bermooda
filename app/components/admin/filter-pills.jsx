import clsx from 'clsx';

const PILL =
  'rounded-full px-3 py-1 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

/**
 * FilterPills
 * Segmented pill row for switching a list filter (status, menu handle, …).
 * Sits inside a `Toolbar` on list pages. Options with an `href` render as
 * plain links (full document navigation); others call `onChange`.
 *
 * @param {Object} props
 * @param {{ value: string, label: React.ReactNode, href?: string }[]} props.options
 * @param {string} props.value Currently selected option value
 * @param {(value: string) => void} [props.onChange]
 * @param {string} [props.ariaLabel] Accessible name for the group
 * @param {string} [props.className]
 * @returns {React.ReactElement}
 */
export default function FilterPills({
  options,
  value,
  onChange,
  ariaLabel,
  className = '',
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={clsx('flex flex-wrap gap-1.5', className)}
    >
      {options.map((option) => {
        const active = option.value === value;
        const classes = clsx(
          PILL,
          active
            ? 'bg-accent text-accent-fg'
            : 'bg-surface-2 text-text-muted hover:text-text'
        );

        if (option.href) {
          return (
            <a
              key={option.value}
              href={option.href}
              aria-current={active ? 'page' : undefined}
              className={classes}
            >
              {option.label}
            </a>
          );
        }

        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange?.(option.value)}
            className={classes}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
