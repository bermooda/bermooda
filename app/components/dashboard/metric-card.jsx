import clsx from 'clsx';

/**
 * Formats a number as a percentage with one decimal place
 *
 * @param {number} value - The percentage value to format
 * @returns {string} Formatted percentage string (e.g., "12.5%")
 */
export function formatPercentage(value) {
  return `${value.toFixed(1)}%`;
}

/**
 * MetricCard component - Displays a single metric with value and percentage change
 *
 * @param {Object} props
 * @param {string} props.label - The label for the metric (e.g., "Total revenue")
 * @param {string|number} props.value - The main value to display (e.g., "$1,234")
 * @param {number} props.percentage - The percentage change from previous period
 * @param {string} [props.periodLabel="from last week"] - The period comparison label
 * @returns {React.ReactElement}
 */
export default function MetricCard({
  label,
  value,
  percentage,
  periodLabel = 'from last week',
}) {
  return (
    <div>
      <hr
        role="presentation"
        className="w-full border-t border-zinc-950/10 dark:border-white/10"
      />
      <div className="mt-6 text-lg/6 font-medium sm:text-sm/6">{label}</div>
      <div className="mt-3 text-3xl/8 font-semibold sm:text-2xl/8">{value}</div>
      <div className="mt-3 text-sm/6 sm:text-xs/6">
        <span
          className={clsx(
            'inline-flex items-center gap-x-1.5 rounded-md px-1.5 py-0.5 text-sm/5 font-medium sm:text-xs/5',
            percentage > 0
              ? 'bg-lime-400/20 text-lime-700'
              : 'bg-pink-400/15 text-pink-700'
          )}
        >
          {formatPercentage(percentage)}
        </span>{' '}
        <span className="text-zinc-500">{periodLabel}</span>
      </div>
    </div>
  );
}
