import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { Form } from 'react-router';

import { controlClasses } from '#/components/admin/form/input';

/**
 * Admin list search input with magnifying-glass icon.
 *
 * @param {Object} props
 * @param {string} [props.name='q']
 * @param {string} [props.defaultValue='']
 * @param {string} props.placeholder
 * @param {string} [props.className]
 * @param {string} [props.formClassName]
 * @param {Record<string, string>} [props.hiddenFields]
 */
export default function SearchField({
  name = 'q',
  defaultValue = '',
  placeholder,
  className = '',
  formClassName = '',
  hiddenFields = {},
}) {
  return (
    <Form method="get" className={clsx('relative', formClassName)}>
      {Object.entries(hiddenFields).map(([fieldName, value]) => (
        <input key={fieldName} type="hidden" name={fieldName} value={value} />
      ))}
      <MagnifyingGlassIcon className="text-text-muted pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
      <input
        type="search"
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className={clsx(controlClasses, 'pl-9', className)}
      />
    </Form>
  );
}
