import clsx from 'clsx';

import { controlClasses } from '#/components/admin/form/input';

/**
 * Select
 * Native select sharing the admin field styling.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children `<option>` elements
 * @param {string} [props.className] Extra classes
 * @returns {React.ReactElement}
 */
export default function Select({ children, className = '', ...props }) {
  return (
    <select className={clsx(controlClasses, 'pr-8', className)} {...props}>
      {children}
    </select>
  );
}
