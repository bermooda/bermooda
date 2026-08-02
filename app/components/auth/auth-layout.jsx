import { Link } from 'react-router';

import { useT } from '#/core/i18n';
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
  const t = useT();

  return (
    <div className="bg-bg flex min-h-full flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link to="/" prefetch="intent">
          <Logo alt={t('admin.auth.logoAlt')} className="mx-auto h-14 w-auto" />
        </Link>
        <h2 className="text-text mt-8 text-center text-2xl/9 font-bold tracking-tight">
          {title}
        </h2>
        {subtitle && (
          <p className="text-text-muted mt-2 text-center text-sm">{subtitle}</p>
        )}
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="border-border bg-surface rounded-2xl border p-6 shadow-xs sm:p-8">
          {children}
        </div>
      </div>
    </div>
  );
}
