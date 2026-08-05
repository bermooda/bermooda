import clsx from 'clsx';

/**
 * Two-column form section (Tailwind UI form-layouts pattern).
 * Left: title + description; right: fields spanning two columns on `md+`.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.title
 * @param {React.ReactNode} [props.description]
 * @param {React.ReactNode} props.children
 * @param {boolean} [props.last=false] Omit bottom border on the final section
 * @returns {React.ReactElement}
 */
export default function FormSection({
  title,
  description,
  children,
  last = false,
}) {
  return (
    <div
      className={clsx(
        'grid grid-cols-1 gap-x-8 gap-y-8 md:grid-cols-3',
        !last && 'border-border border-b pb-12'
      )}
    >
      <div>
        <h2 className="text-text text-base/7 font-semibold">{title}</h2>
        {description ? (
          <p className="text-text-muted mt-1 text-sm/6">{description}</p>
        ) : null}
      </div>
      <div className="min-w-0 md:col-span-2">{children}</div>
    </div>
  );
}
