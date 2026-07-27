import clsx from 'clsx';

import useMounted from '#/hooks/use-mounted';

/**
 * Reveal
 * Staggered entrance wrapper. Renders its children in their final position
 * during SSR-to-hydration, then transitions them in on the next frame so a
 * page load reads as one orchestrated motion instead of scattered effects.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children
 * @param {number} [props.delay=0] Milliseconds before this element animates
 * @param {string} [props.from='translate-y-3'] Offset class applied while hidden
 * @param {string} [props.className]
 * @param {React.ElementType} [props.as='div'] Element to render
 * @returns {React.ReactElement}
 */
export default function Reveal({
  children,
  delay = 0,
  from = 'translate-y-3',
  className = '',
  as: Tag = 'div',
}) {
  const mounted = useMounted();

  return (
    <Tag
      className={clsx(
        'transition-[opacity,transform] duration-700 ease-out motion-reduce:transition-none',
        mounted ? 'translate-y-0 opacity-100' : `${from} opacity-0`,
        className
      )}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </Tag>
  );
}
