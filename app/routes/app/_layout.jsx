import { Outlet } from 'react-router';
import { Toaster } from 'sonner';

import { authContext, authMiddleware } from '#/libs/auth/index.server';
import { SidebarProvider } from '#/hooks/use-sidebar';
import MobileHeader from '#/components/header/mobile';
import Sidebar from '#/components/sidebar';

export const middleware = [authMiddleware];

// This loader runs for ALL child routes of this layout route
export async function loader({ context }) {
  const user = context.get(authContext);

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name || 'User',
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
  };
}

export default function UserAreaLayout({ loaderData }) {
  return (
    <SidebarProvider>
      <div className="dark-gradient-main flex min-h-svh bg-zinc-100">
        <Sidebar />

        {/* Main content */}
        <div className="flex flex-1 flex-col md:pt-2 md:pr-2 md:pb-2 md:pl-64">
          <MobileHeader />

          <main className="dark:border-dark-700/50 dark-gradient-card flex-1 overflow-auto border-gray-200 bg-white p-6 md:rounded-lg md:border md:p-10 md:shadow-xs">
            <div className="mx-auto max-w-7xl">
              {/* Pass data to child routes using Outlet context */}
              <Outlet context={loaderData} />
            </div>
          </main>
        </div>
      </div>
      <Toaster position="top-right" />
    </SidebarProvider>
  );
}
