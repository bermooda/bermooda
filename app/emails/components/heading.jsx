import { Heading } from '@react-email/components';

/**
 * Email template for heading
 *
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - The child components
 */
export default function EmailHeading({ children }) {
  return (
    <Heading className="dark-mode-heading mt-10 mb-6 text-center text-2xl font-bold text-slate-800">
      {children}
    </Heading>
  );
}
