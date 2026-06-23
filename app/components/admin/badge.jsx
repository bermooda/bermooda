import clsx from 'clsx';

const TONES = {
  neutral: 'bg-surface-2 text-text-muted',
  success:
    'bg-success/15 text-success dark:bg-success/20',
  warn: 'bg-warn/15 text-warn dark:bg-warn/20',
  danger: 'bg-danger/15 text-danger dark:bg-danger/20',
  accent: 'bg-accent/15 text-accent dark:bg-accent/20',
};

/**
 * Badge
 * Small status pill. Color conveys meaning, not decoration.
 *
 * @param {Object} props
 * @param {'neutral'|'success'|'warn'|'danger'|'accent'} [props.tone='neutral']
 * @param {React.ReactNode} props.children
 * @param {string} [props.className] Extra classes
 * @returns {React.ReactElement}
 */
export default function Badge({ tone = 'neutral', children, className = '' }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize',
        TONES[tone] ?? TONES.neutral,
        className
      )}
    >
      {children}
    </span>
  );
}
