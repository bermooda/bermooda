import { controlClassName } from '#/components/admin/form/input';

/**
 * Textarea
 * Multi-line text control sharing the admin field styling.
 *
 * @param {Object} props
 * @param {string} [props.className] Extra classes
 * @returns {React.ReactElement}
 */
export default function Textarea({ className = '', ...props }) {
  return <textarea className={controlClassName(className)} {...props} />;
}
