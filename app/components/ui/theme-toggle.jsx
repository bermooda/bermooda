import { MoonIcon, SunIcon } from '@heroicons/react/24/outline';

import useTheme from '#/hooks/use-theme';

/**
 * Theme Toggle Component
 * A button that toggles between light and dark mode
 *
 * @param {Object} props - Component props
 * @param {string} [props.className] - Additional CSS classes
 * @returns {React.ReactElement} The theme toggle button
 */
export default function ThemeToggle({ className = '' }) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`dark:text-dark-400 dark:hover:bg-dark-700/50 dark:hover:text-accent-fuchsia rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${className}`}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? (
        <SunIcon className="h-5 w-5" aria-hidden="true" />
      ) : (
        <MoonIcon className="h-5 w-5" aria-hidden="true" />
      )}
    </button>
  );
}

/**
 * Theme Toggle with Label Component
 * A button with icon and text label for theme toggling
 *
 * @param {Object} props - Component props
 * @param {string} [props.className] - Additional CSS classes
 * @returns {React.ReactElement} The theme toggle button with label
 */
export function ThemeToggleWithLabel({ className = '' }) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`group text-md dark:text-dark-400 dark:hover:bg-dark-700/50 dark:hover:text-dark-300 flex w-full items-center rounded-md px-2 py-2 font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 md:text-sm md:hover:bg-gray-200 ${className}`}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? (
        <SunIcon
          className="dark:text-accent-fuchsia dark:group-hover:text-accent-cyan mr-3 h-5 w-5 text-gray-500 group-hover:text-gray-600"
          aria-hidden="true"
        />
      ) : (
        <MoonIcon
          className="dark:text-dark-500 dark:group-hover:text-dark-400 mr-3 h-5 w-5 text-gray-500 group-hover:text-gray-600"
          aria-hidden="true"
        />
      )}
      {isDark ? 'Light Mode' : 'Dark Mode'}
    </button>
  );
}
