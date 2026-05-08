import { Link } from 'react-router';

import Logo from '#/components/ui/logo';

/**
 * Auth Layout Component
 * Centered form wrapper with logo, heading, and subtitle
 * Used by admin sign-in and password-reset flows
 *
 * @param {Object} props Component props
 * @param {string} props.title Main heading text
 * @param {string} [props.subtitle] Optional subtitle text
 * @param {React.ReactNode} props.children Child components to render
 * @returns {React.ReactElement} Auth layout component
 */
export default function AuthLayout({ title, subtitle, children }) {
  return (
    <div className="dark-mesh-gradient flex min-h-full flex-1 flex-col justify-center px-6 py-12 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-sm">
        <Link to="/" prefetch="intent">
          <Logo alt="Your Company" className="mx-auto h-16 w-auto" />
        </Link>
        <h2 className="mt-10 text-center text-2xl/9 font-bold tracking-tight text-gray-900 dark:text-white">
          {title}
        </h2>
        {subtitle && (
          <p className="dark:text-dark-500 mt-2 text-center text-sm text-gray-600">
            {subtitle}
          </p>
        )}
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">{children}</div>
    </div>
  );
}
