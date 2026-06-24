import clsx from 'clsx';

/**
 * Card
 * Neutral surface container with a hairline border. The default building
 * block for admin content panels.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children
 * @param {string} [props.className] Extra classes
 * @param {boolean} [props.padded=true] Apply default inner padding
 * @returns {React.ReactElement}
 */
export default function Card({ children, className = '', padded = true }) {
  return (
    <div
      className={clsx(
        'border-border bg-surface rounded-xl border shadow-xs',
        padded && 'p-4 sm:p-6',
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * CardSection
 * A divided section inside a Card, separated by a hairline top border.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children
 * @param {string} [props.className] Extra classes
 * @returns {React.ReactElement}
 */
export function CardSection({ children, className = '' }) {
  return (
    <div className={clsx('border-border border-t p-4 sm:p-6', className)}>
      {children}
    </div>
  );
}
