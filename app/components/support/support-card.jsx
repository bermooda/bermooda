import { Link } from 'react-router';

/**
 * SupportCard component - Displays a support option card with icon, title, description, and optional link
 *
 * @param {Object} props
 * @param {React.ReactNode} props.icon - Icon element to display
 * @param {string} props.title - Card title
 * @param {string} props.description - Card description text
 * @param {string} [props.href] - Link URL (optional)
 * @param {boolean} [props.isExternal] - Whether the link is external
 * @param {string} [props.linkText] - Custom link button text (defaults to "Learn more")
 * @returns {React.ReactElement}
 */
export default function SupportCard({
  icon,
  title,
  description,
  href,
  isExternal,
  linkText,
}) {
  const CardWrapper = href ? Link : 'div';
  const linkProps = href
    ? isExternal
      ? { to: href, target: '_blank', rel: 'noopener noreferrer' }
      : { to: href }
    : {};

  return (
    // @ts-ignore
    <CardWrapper
      {...linkProps}
      className="group relative overflow-hidden rounded-xl border border-zinc-200 bg-white p-6 transition-all hover:border-zinc-300 hover:shadow-lg dark:border-zinc-700 dark:bg-zinc-800 dark:hover:border-zinc-600"
    >
      {/* Icon */}
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-cyan-50 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400">
        {icon}
      </div>

      {/* Content */}
      <h3 className="mb-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        {title}
      </h3>
      <p className="mb-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        {description}
      </p>

      {/* Link/Action */}
      {href && (
        <div className="flex items-center gap-2 text-sm font-medium text-cyan-600 transition-colors group-hover:text-cyan-500 dark:text-cyan-400">
          {linkText || 'Learn more'}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="h-4 w-4 transition-transform group-hover:translate-x-1"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
            />
          </svg>
        </div>
      )}
    </CardWrapper>
  );
}
