/**
 * PeriodSelector component - Dropdown selector for choosing time periods
 *
 * @param {Object} props
 * @param {string} [props.name="period"] - The name attribute for the select element
 * @param {string} [props.value] - The currently selected value
 * @param {Function} [props.onChange] - Change handler function
 * @param {Array<{value: string, label: string}>} [props.options] - Array of period options
 * @returns {React.ReactElement}
 */
export default function PeriodSelector({
  name = 'period',
  value,
  onChange,
  options = [
    { value: 'last_week', label: 'Last week' },
    { value: 'last_two', label: 'Last two weeks' },
    { value: 'last_month', label: 'Last month' },
    { value: 'last_quarter', label: 'Last quarter' },
  ],
}) {
  return (
    <span
      data-slot="control"
      className="group relative block w-full before:absolute before:inset-px before:rounded-[calc(var(--radius-lg)-1px)] before:bg-white before:shadow-sm after:pointer-events-none after:absolute after:inset-0 after:rounded-lg after:ring-transparent after:ring-inset has-data-disabled:opacity-50 has-data-disabled:before:bg-zinc-950/5 has-data-disabled:before:shadow-none has-data-focus:after:ring-2 has-data-focus:after:ring-blue-500 dark:before:hidden"
    >
      <select
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="relative block w-full appearance-none rounded-lg border border-zinc-950/10 bg-transparent py-[calc(--spacing(2.5)-1px)] pr-[calc(--spacing(10)-1px)] pl-[calc(--spacing(3.5)-1px)] text-base/6 text-zinc-950 placeholder:text-zinc-500 focus:outline-hidden data-disabled:border-zinc-950/20 data-disabled:opacity-100 data-hover:border-zinc-950/20 data-invalid:border-red-500 data-invalid:data-hover:border-red-500 sm:py-[calc(--spacing(1.5)-1px)] sm:pr-[calc(--spacing(9)-1px)] sm:pl-[calc(--spacing(3)-1px)] sm:text-sm/6 dark:border-white/10 dark:bg-white/5 dark:text-white dark:*:bg-zinc-800 dark:*:text-white dark:data-disabled:border-white/15 dark:data-disabled:bg-white/2.5 dark:data-hover:border-white/20 dark:data-hover:data-disabled:border-white/15 dark:data-invalid:border-red-600 dark:data-invalid:data-hover:border-red-600"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
        <svg
          className="size-5 stroke-zinc-500 group-has-data-disabled:stroke-zinc-600 sm:size-4 dark:stroke-zinc-400 forced-colors:stroke-[CanvasText]"
          viewBox="0 0 16 16"
          aria-hidden="true"
          fill="none"
        >
          <path
            d="M5.75 10.75L8 13L10.25 10.75"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          ></path>
          <path
            d="M10.25 5.25L8 3L5.75 5.25"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          ></path>
        </svg>
      </span>
    </span>
  );
}
