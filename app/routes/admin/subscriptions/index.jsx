// app/routes/admin/subscriptions/index.jsx
// Subscription plans list.

import { PlusIcon } from '@heroicons/react/24/outline';
import { Link, useLoaderData } from 'react-router';

import { loadSubscriptionPlanAdminData } from '#/core/subscriptions/index.server';
import Card from '#/components/admin/card';
import PageHeader from '#/components/admin/page-header';

export async function loader() {
  return loadSubscriptionPlanAdminData();
}

export default function AdminSubscriptionsRoute() {
  const { plans } = useLoaderData();

  return (
    <div>
      <PageHeader
        title="Subscription plans"
        subtitle="Recurring billing foundation — connect Stripe subscription mode for production."
        actions={
          <Link
            to="/admin/subscriptions/new"
            className="bg-accent text-accent-fg hover:bg-accent-hover focus-visible:outline-accent inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-semibold shadow-sm transition focus-visible:outline focus-visible:outline-offset-2"
          >
            <PlusIcon className="h-4 w-4" />
            New plan
          </Link>
        }
        className="mb-6"
      />

      <Card>
        <h2 className="text-text mb-4 text-sm font-semibold">Plans</h2>
        {plans.length === 0 ? (
          <p className="text-text-muted text-sm">
            No subscription plans yet.{' '}
            <Link
              to="/admin/subscriptions/new"
              className="text-accent hover:underline"
            >
              Create your first plan
            </Link>
            .
          </p>
        ) : (
          <ul className="divide-border divide-y">
            {plans.map((plan) => (
              <li
                key={plan.id}
                className="flex items-center justify-between py-3 text-sm"
              >
                <Link
                  to={`/admin/subscriptions/${plan.id}`}
                  className="hover:text-accent block"
                >
                  <p className="text-text font-medium">{plan.name}</p>
                  <p className="text-text-muted text-xs">
                    Every {plan.intervalCount} {plan.interval}
                    {plan.variant?.sku ? ` · ${plan.variant.sku}` : ''}
                  </p>
                </Link>
                <span
                  className={
                    plan.active
                      ? 'text-xs font-medium text-green-700'
                      : 'text-text-muted text-xs'
                  }
                >
                  {plan.active ? 'Active' : 'Inactive'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
