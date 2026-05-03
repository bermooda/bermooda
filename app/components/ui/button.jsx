import { Button as HeadlessButton } from '@headlessui/react';
import clsx from 'clsx';
import { useNavigation } from 'react-router';

import Spinner from '#/components/ui/spinner';

/**
 * Button Component
 *
 * @param {Object} props Component props
 * @param {'button'|'submit'|'reset'} [props.type='button'] Button type
 * @param {string} [props.className] Additional classes to apply
 * @param {boolean} [props.disabled] Whether the button is disabled
 * @param {React.ReactNode} props.children Button text content
 * @returns {React.ReactElement} Button component
 */
export default function Button({
  type = 'button',
  className = '',
  disabled = false,
  children,
  ...props
}) {
  const buttonClasses = clsx(
    'flex justify-center rounded-md px-3 py-1.5 text-sm leading-6 font-semibold shadow-sm focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-70',
    type === 'submit'
      ? 'bg-slate-900 text-white hover:bg-slate-800 accent-gradient glow-accent-sm'
      : 'bg-white text-gray-900 border border-gray-300 hover:bg-gray-50 dark:bg-dark-800 dark:text-dark-300 dark:border-dark-600 dark:hover:bg-dark-700',
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
