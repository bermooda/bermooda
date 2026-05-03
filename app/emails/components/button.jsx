import { Button } from '@react-email/components';

/**
 * Email template for resetting password
 *
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Button content
 * @param {string} props.url - URL for button
 */
export default function EmailButton({ children, url }) {
  return (
    <Button
      href={url}
      className="block rounded-md bg-indigo-600 px-5 py-3 font-medium text-white no-underline"
    >
      {children}
    </Button>
  );
}
