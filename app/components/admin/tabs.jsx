import clsx from 'clsx';

/**
 * Tabs
 * Ghost-style underlined tab bar. Presentation-only; the parent owns the
 * active index and renders the matching panel.
 *
 * @param {Object} props
 * @param {string[]} props.tabs Tab labels
 * @param {number} props.active Index of the active tab
 * @param {(index: number) => void} props.onChange Called with the new index
 * @param {string} [props.className] Extra classes on the tab bar
 * @returns {React.ReactElement}
 */
export default function Tabs({ tabs, active, onChange, className = '' }) {
  return (
    <div
      className={clsx('border-border flex flex-wrap gap-1 border-b', className)}
    >
      {tabs.map((tab, i) => (
        <button
          key={tab}
          type="button"
          onClick={() => onChange(i)}
          className={clsx(
            'px-4 py-2 text-sm font-medium transition-colors focus:outline-none',
            active === i
              ? 'border-accent text-accent border-b-2'
              : 'text-text-muted hover:text-text'
          )}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}
