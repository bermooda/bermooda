import { ChartBarIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { useLoaderData } from 'react-router';

import { authContext } from '#/libs/auth/index.server';
import MetricCard from '#/components/dashboard/metric-card';
import PeriodSelector from '#/components/dashboard/period-selector';

export function meta() {
  return [
    { title: 'Dashboard - Your Account' },
    { name: 'description', content: 'Account overview' },
  ];
}

export async function loader({ context, request }) {
  const user = context.get(authContext);
  const url = new URL(request.url);
  let isNewUser = url.searchParams.get('welcome-message') === 'true';

  if (user) {
    const now = new Date();
    const userCreated = new Date(user.createdAt);
    const timeDiff = now.getTime() - userCreated.getTime();

    // If user was created within last 30 seconds, likely first login
    if (timeDiff < 30000) {
      isNewUser = true;
    }
  }

  // TODO: Get dashboard data from the database
  return {
    dashboardData: {
      revenue: {
        total: '$1.8M',
        pct: 6.4,
      },
      averageOrderValue: {
        total: '$129',
        pct: -0.5,
      },
      ticketsSold: {
        total: '4,800',
        pct: 2.1,
      },
      pageviews: {
        total: '921K',
        pct: 15.5,
      },
    },
    user,
    isNewUser,
  };
}

/**
 * Dashboard Route Component
 *
 * @returns {React.ReactNode}
 */
export default function DashboardRoute() {
  const { dashboardData, user, isNewUser } = useLoaderData();
  const [showWelcome, setShowWelcome] = useState(isNewUser);

  return (
    <>
      {showWelcome && (
        <div className="mb-6 rounded-lg border border-lime-200 bg-lime-50 p-4 dark:bg-lime-950/30">
          <div className="flex">
            <div className="shrink-0">
              <svg
                className="h-5 w-5 text-lime-600 dark:text-lime-500"
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
              <h3 className="text-sm font-medium text-lime-800 dark:text-lime-300">
                Welcome to your dashboard, {user.name || 'there'}!
              </h3>
              <div className="mt-2 text-sm text-lime-700 dark:text-lime-400">
                <p>
                  Your account has been successfully created and your email is
                  verified. You can now explore all the features available to
                  you.
                </p>
              </div>
              <div className="mt-4">
                <div className="-mx-2 -my-1.5 flex">
                  <button
                    type="button"
                    onClick={() => setShowWelcome(false)}
                    className="rounded-md bg-lime-50 px-2 py-1.5 text-sm font-medium text-lime-800 hover:bg-lime-100 focus:ring-2 focus:ring-lime-600 focus:ring-offset-2 focus:ring-offset-lime-50 focus:outline-none dark:bg-lime-900/40 dark:text-lime-300 dark:hover:bg-lime-900/60 dark:focus:ring-lime-500 dark:focus:ring-offset-lime-900"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center space-x-2">
          <ChartBarIcon className="h-8 w-8" />
          <h1 className="text-2xl/8 font-semibold text-zinc-950 sm:text-xl/8 dark:text-white">
            Dashboard
          </h1>
        </div>
        <main className="mt-8">
          <div className="mt-8 flex items-end justify-between">
            <h2 className="text-base/7 font-semibold text-zinc-950 sm:text-sm/6 dark:text-white">
              Overview
            </h2>
            <div>
              <PeriodSelector />
            </div>
          </div>

          <div className="mt-4 grid gap-8 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Total revenue"
              value={dashboardData.revenue.total}
              percentage={dashboardData.revenue.pct}
            />
            <MetricCard
              label="Average order value"
              value={dashboardData.averageOrderValue.total}
              percentage={dashboardData.averageOrderValue.pct}
            />
            <MetricCard
              label="Tickets sold"
              value={dashboardData.ticketsSold.total}
              percentage={dashboardData.ticketsSold.pct}
            />
            <MetricCard
              label="Pageviews"
              value={dashboardData.pageviews.total}
              percentage={dashboardData.pageviews.pct}
            />
          </div>

          <h2 className="mt-16 text-2xl font-semibold text-zinc-950 dark:text-white">
            Add your dashboard data here!
          </h2>
        </main>
      </div>
    </>
  );
}
