import { Button as HeadlessButton } from '@headlessui/react';
import clsx from 'clsx';
import { useNavigation } from 'react-router';

import Spinner from '#/components/ui/spinner';

/**
 * Visual variants built on the single semantic accent token. Decorative
 * gradients/glow have been dropped in favour of flat, Ghost-style surfaces.
 *
 * @type {Record<'primary'|'secondary'|'ghost'|'danger', string>}
 */
const VARIANTS = {
  primary:
    'bg-accent text-accent-fg hover:bg-accent-hover focus-visible:outline-accent',
  secondary:
    'bg-surface text-text border border-border hover:bg-surface-2 focus-visible:outline-accent',
  ghost:
    'bg-transparent text-text hover:bg-surface-2 focus-visible:outline-accent',
  danger: 'bg-danger text-white hover:opacity-90 focus-visible:outline-danger',
};

/**
 * Button Component
 *
 * @param {Object} props Component props
 * @param {'button'|'submit'|'reset'} [props.type='button'] Button type
 * @param {'primary'|'secondary'|'ghost'|'danger'} [props.variant] Visual style.
 *   Defaults to `primary` for submit buttons and `secondary` otherwise.
 * @param {string} [props.className] Additional classes to apply
 * @param {boolean} [props.disabled] Whether the button is disabled
 * @param {React.ReactNode} props.children Button text content
 * @returns {React.ReactElement} Button component
 */
export default function Button({
  type = 'button',
  variant,
  className = '',
  disabled = false,
  children,
  ...props
}) {
  const resolvedVariant =
    variant ?? (type === 'submit' ? 'primary' : 'secondary');

  const buttonClasses = clsx(
    'flex items-center justify-center rounded-md px-3 py-1.5 text-sm leading-6 font-semibold shadow-sm transition focus-visible:outline focus-visible:outline-offset-2 disabled:opacity-70',
    VARIANTS[resolvedVariant] ?? VARIANTS.secondary,
    className
  );

  return (
    <HeadlessButton
      type={type}
      className={buttonClasses}
      disabled={disabled}
      {...props}
    >
      {children}
    </HeadlessButton>
  );
}

/**
 * Button Submit Component
 *
 * @param {Object} props Component props
 * @param {React.ReactNode} props.children Button text content
 * @param {string} [props.className] Additional classes to apply
 * @param {boolean} [props.disabled] Whether the button is disabled
 * @param {boolean} [props.loading] Whether the button is loading
 * @returns {React.ReactElement} Button component
 */
export function ButtonSubmit({
  children,
  className,
  disabled,
  loading,
  ...props
}) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  return (
    <Button
      type="submit"
      disabled={isSubmitting || disabled}
      className={className}
      {...props}
    >
      {isSubmitting || loading ? (
        <div className="flex h-6 items-center">
          <Spinner />
        </div>
      ) : (
        children
      )}
    </Button>
  );
}
