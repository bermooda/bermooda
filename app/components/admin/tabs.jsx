import clsx from 'clsx';

const VARIANTS = {
  underline: {
    list: 'border-border flex flex-wrap gap-1 border-b',
    tab: (active) =>
      clsx(
        'rounded-t-md px-4 py-2 text-sm font-medium transition-colors focus:outline-none',
        active
          ? 'border-accent text-accent border-b-2'
          : 'text-text-muted hover:text-text'
      ),
  },
  pills: {
    list: 'bg-surface-2 inline-flex flex-wrap gap-1 rounded-lg p-1',
    tab: (active) =>
      clsx(
        'rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none',
        active
          ? 'bg-surface text-text shadow-xs'
          : 'text-text-muted hover:text-text'
      ),
  },
};

/**
 * Tabs
 * Admin tab bar. Presentation-only; the parent owns the active index and
 * renders the matching panel.
 *
 * @param {Object} props
 * @param {string[]} props.tabs Tab labels
 * @param {number} props.active Index of the active tab
 * @param {(index: number) => void} props.onChange Called with the new index
 * @param {'underline'|'pills'} [props.variant='underline']
 * @param {string} [props.className] Extra classes on the tab bar
 * @returns {React.ReactElement}
 */
export default function Tabs({
  tabs,
  active,
  onChange,
  variant = 'underline',
  className = '',
}) {
  const styles = VARIANTS[variant] ?? VARIANTS.underline;

  return (
    <div className={clsx(styles.list, className)} role="tablist">
      {tabs.map((tab, i) => (
        <button
          key={tab}
          type="button"
          role="tab"
          aria-selected={active === i}
          onClick={() => onChange(i)}
          className={styles.tab(active === i)}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}
