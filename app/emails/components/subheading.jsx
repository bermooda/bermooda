import { Text } from '@react-email/components';

/**
 * Email template for subheading
 *
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - The child components
 */
export default function EmailSubheading({ children }) {
  return (
    <Text className="dark-mode-text mb-4 py-4 text-center text-base text-slate-700">
      {children}
    </Text>
  );
}
