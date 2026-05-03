import { Bars3Icon } from '@heroicons/react/24/outline';

import useSidebar from '#/hooks/use-sidebar';

export default function SidebarToggle() {
  const { openSidebar } = useSidebar();

  return (
    <button
      type="button"
      onClick={openSidebar}
      className="inline-flex items-center justify-center rounded-md p-2 text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
    >
      <span className="sr-only">Open menu</span>
      <Bars3Icon className="h-6 w-6" />
    </button>
  );
}
