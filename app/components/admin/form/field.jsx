import clsx from 'clsx';

/**
 * Field
 * Label + control wrapper with optional hint and error message.
 *
 * @param {Object} props
 * @param {string} [props.label] Field label text
 * @param {string} [props.htmlFor] id of the associated control
 * @param {React.ReactNode} props.children The control (Input/Select/Textarea)
 * @param {React.ReactNode} [props.hint] Helper text shown below the control
 * @param {React.ReactNode} [props.error] Error message (overrides hint styling)
 * @param {string} [props.className] Extra classes on the wrapper
 * @returns {React.ReactElement}
 */
export default function Field({
  label,
  htmlFor,
  children,
  hint,
  error,
  className = '',
}) {
  return (
    <div className={clsx('space-y-2', className)}>
      {label && (
        <label
          htmlFor={htmlFor}
          className="text-text block text-sm/6 font-medium"
        >
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-danger text-sm">{error}</p>
      ) : (
        hint && <p className="text-text-muted text-sm">{hint}</p>
      )}
    </div>
  );
}
