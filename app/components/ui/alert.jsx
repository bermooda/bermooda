/**
 * Error Alert Component
 * Displays error messages with a red background and icon
 *
 * @param {Object} props Component props
 * @param {string} props.message Error message to display
 * @returns {React.ReactElement} Error alert component
 */
export function ErrorAlert({ message }) {
  if (!message) return null;

  return (
    <div className="mb-4 rounded-md bg-red-50 p-4 dark:border dark:border-red-500/30 dark:bg-red-500/10">
      <div className="flex">
        <div className="shrink-0">
          <svg
            className="h-5 w-5 text-red-400 dark:text-red-400"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div className="ml-3">
          <h3 className="text-sm/6 font-medium text-red-800 dark:text-red-300">
            {message}
          </h3>
        </div>
      </div>
    </div>
  );
}

/**
 * Success Alert Component
 * Displays success messages with a green background
 *
 * @param {Object} props Component props
 * @param {string} props.message Success message to display
 * @returns {React.ReactElement} Success alert component
 */
export function SuccessAlert({ message }) {
  if (!message) return null;

  return (
    <div className="mb-4 rounded-md border border-green-200 bg-green-50 p-4 shadow-xs dark:border-green-500/30 dark:bg-green-500/10">
      <div className="flex">
        <div className="shrink-0">
          <svg
            className="h-5 w-5 text-green-400"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div className="ml-3">
          <h3 className="text-sm/6 font-medium text-green-800 dark:text-green-400">
            {message}
          </h3>
        </div>
      </div>
    </div>
  );
}
