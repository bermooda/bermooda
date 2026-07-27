import clsx from 'clsx';

/**
 * Reveal
 * Staggered entrance wrapper for create-page sections.
 *
 * The animation is pure CSS (see `cp-reveal` in `admin-create-page.css`) and
 * deliberately not gated on a mount effect: the final state is what the
 * browser paints when the animation does not run, so a hydration failure or
 * disabled JS costs the motion, not the content.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children
 * @param {number} [props.delay=0] Milliseconds before this element animates
 * @param {string} [props.from='translateY(12px)'] Starting transform
 * @param {string} [props.className]
 * @param {React.ElementType} [props.as='div'] Element to render
 * @returns {React.ReactElement}
 */
export default function Reveal({
  children,
  delay = 0,
  from = 'translateY(12px)',
  className = '',
  as: Tag = 'div',
}) {
  return (
    <Tag
      className={clsx('cp-reveal', className)}
      style={{
        '--cp-reveal-delay': `${delay}ms`,
        '--cp-reveal-from': from,
      }}
    >
      {children}
    </Tag>
  );
}
