import clsx from 'clsx';
import { Fragment } from 'react';

/**
 * PageHeader
 * Ghost-style page top: optional breadcrumbs, title, subtitle, and actions.
 * Stacks vertically on mobile and becomes a row on `sm+`.
 *
 * When `sticky` is set, the title/actions row pins while scrolling. Breadcrumbs
 * stay in normal flow. Sticky styles are applied without a short wrapping
 * parent so the nearest tall ancestor (e.g. the editor shell) is the
 * containing block — wrapping only the header would clip stickiness.
 *
 * @param {Object} props
 * @param {React.ReactNode} [props.breadcrumbs] Optional breadcrumb trail
 * @param {React.ReactNode} props.title Page title
 * @param {React.ReactNode} [props.subtitle] Optional supporting text
 * @param {React.ReactNode} [props.actions] Right-aligned actions (buttons, etc.)
 * @param {boolean} [props.sticky=false] Pin title/actions (not breadcrumbs) while scrolling
 * @param {string} [props.className] Extra classes on the title/actions row when sticky;
 *   otherwise on the outer wrapper
 * @returns {React.ReactElement}
 */
export default function PageHeader({
  breadcrumbs,
  title,
  subtitle,
  actions,
  sticky = false,
  className = '',
}) {
  const titleBlock = (
    <>
      <div className="min-w-0">
        <h1 className="text-text truncate text-2xl font-semibold tracking-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="text-text-muted mt-1.5 text-sm leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      )}
    </>
  );

  if (sticky) {
    // Fragment so the sticky row is a direct child of the tall editor shell —
    // a short wrapper around only the header would clip position:sticky.
    return (
      <Fragment>
        {breadcrumbs}
        <div
          className={clsx(
            'border-border/50 bg-bg/90 sticky top-0 z-10 mb-8 flex flex-col gap-4 border-b py-4 backdrop-blur backdrop-filter supports-backdrop-filter:bg-bg/80 sm:flex-row sm:items-center sm:justify-between',
            className
          )}
        >
          {titleBlock}
        </div>
      </Fragment>
    );
  }

  return (
    <div className={clsx('mb-8', className)}>
      {breadcrumbs}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {titleBlock}
      </div>
    </div>
  );
}
