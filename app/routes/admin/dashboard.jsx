export function meta() {
  return [
    { title: 'Admin Dashboard' },
    { name: 'description', content: 'Admin dashboard overview' },
  ];
}

/**
 * Admin Dashboard Route (stub — content added in P5-2)
 * @returns {React.ReactElement}
 */
export default function AdminDashboardRoute() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
        Dashboard
      </h1>
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
        Welcome to the admin panel. Analytics and stats coming in P5-2.
      </p>
    </div>
  );
}
