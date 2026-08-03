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
    <div className="bg-danger/10 border-danger/30 mb-4 rounded-md border p-4">
      <div className="flex">
        <div className="shrink-0">
          <svg
            className="text-danger h-5 w-5"
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
          <h3 className="text-danger text-sm/6 font-medium">{message}</h3>
        </div>
      </div>
    </div>
  );
}

/**
 * Success Alert Component
 * Displays success messages with the success (brand accent) background
 *
 * @param {Object} props Component props
 * @param {string} props.message Success message to display
 * @returns {React.ReactElement} Success alert component
 */
export function SuccessAlert({ message }) {
  if (!message) return null;

  return (
    <div className="bg-success/10 border-success/30 mb-4 rounded-md border p-4 shadow-xs">
      <div className="flex">
        <div className="shrink-0">
          <svg
            className="text-success h-5 w-5"
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
          <h3 className="text-success text-sm/6 font-medium">{message}</h3>
        </div>
      </div>
    </div>
  );
}
