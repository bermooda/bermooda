import { fieldDomId } from '#/components/admin/create-page/spec';

/** @typedef {import('#/components/admin/create-page/spec').CreateFieldSpec} CreateFieldSpec */

/**
 * FieldControl
 * Renders the native control for a field spec. Designs own the label and
 * wrapper markup and pass their own `className` so the same DOM can carry
 * radically different styling.
 *
 * @param {Object} props
 * @param {CreateFieldSpec} props.field
 * @param {string} props.sectionId
 * @param {string} props.className
 * @param {(name: string, value: string) => void} [props.onValueChange]
 * @param {boolean} [props.required] Overrides `field.required`. Designs that
 *   hide fields (step flows) must opt out of native validation, which cannot
 *   focus an invisible control.
 * @param {string} [props.autoComplete]
 * @returns {React.ReactElement}
 */
export default function FieldControl({
  field,
  sectionId,
  className,
  onValueChange,
  required,
  autoComplete = 'off',
}) {
  const id = fieldDomId(sectionId, field.name);

  /** @param {React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>} event */
  function handleChange(event) {
    onValueChange?.(field.name, event.currentTarget.value);
  }

  const shared = {
    id,
    name: field.name,
    className,
    autoComplete,
    required: required ?? field.required,
    onChange: onValueChange ? handleChange : undefined,
  };

  if (field.type === 'select') {
    return (
      <select {...shared} defaultValue={field.defaultValue ?? ''}>
        {(field.options ?? []).map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === 'textarea') {
    return (
      <textarea
        {...shared}
        rows={field.rows ?? 4}
        placeholder={field.placeholder}
        defaultValue={field.defaultValue}
      />
    );
  }

  return (
    <input
      {...shared}
      type={field.type ?? 'text'}
      placeholder={field.placeholder}
      defaultValue={field.defaultValue}
    />
  );
}
