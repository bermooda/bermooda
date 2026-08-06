import Field from '#/components/admin/form/field';
import Input from '#/components/admin/form/input';

/**
 * URL slug input with a leading "/" prefix.
 *
 * @param {Object} props
 * @param {string} props.id
 * @param {string} props.name
 * @param {string} [props.label]
 * @param {string} [props.hint]
 * @param {string} [props.defaultValue]
 * @param {string} [props.value]
 * @param {(event: React.ChangeEvent<HTMLInputElement>) => void} [props.onChange]
 * @param {string} [props.placeholder]
 * @param {boolean} [props.required]
 */
export default function SlugField({
  id,
  name,
  label,
  hint,
  defaultValue,
  value,
  onChange,
  placeholder,
  required = false,
}) {
  const inputProps =
    value !== undefined
      ? { value, onChange }
      : { defaultValue: defaultValue ?? '' };

  return (
    <Field label={label} htmlFor={id} hint={hint}>
      <div className="relative">
        <span className="text-text-muted pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm">
          /
        </span>
        <Input
          id={id}
          name={name}
          type="text"
          placeholder={placeholder}
          required={required}
          pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
          className="pl-4.5"
          {...inputProps}
        />
      </div>
    </Field>
  );
}
