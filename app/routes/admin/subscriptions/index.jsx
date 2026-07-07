// app/routes/admin/subscriptions/index.jsx
// Subscription plans admin UI.

import { PlusIcon } from '@heroicons/react/24/outline';
import { Form, useLoaderData } from 'react-router';

import {
  createSubscriptionPlan,
  loadSubscriptionPlanAdminData,
  parseCreatePlanFromForm,
} from '#/core/subscriptions/index.server';
import Card from '#/components/admin/card';
import Input from '#/components/admin/form/input';
import Select from '#/components/admin/form/select';
import PageHeader from '#/components/admin/page-header';
import Button from '#/components/ui/button';

export async function loader() {
  return loadSubscriptionPlanAdminData();
}

export async function action({ request }) {
  const formData = await request.formData();
  const intent = formData.get('intent');

  if (intent === 'create-plan') {
    try {
      const input = parseCreatePlanFromForm(formData);
      await createSubscriptionPlan(input);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  return { ok: false, error: 'Unknown action.' };
}

export default function AdminSubscriptionsRoute() {
  const { plans, variants } = useLoaderData();

  return (
    <div>
      <PageHeader
        title="Subscription plans"
        subtitle="Recurring billing foundation — connect Stripe subscription mode for production."
        className="mb-6"
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="text-text mb-4 text-sm font-semibold">Create plan</h2>
          <Form method="post" className="space-y-4">
            <input type="hidden" name="intent" value="create-plan" />
            <div>
              <label className="text-text-muted mb-1 block text-xs font-medium">
                Name
              </label>
              <Input name="name" required placeholder="Monthly coffee box" />
            </div>
            <div>
              <label className="text-text-muted mb-1 block text-xs font-medium">
                Product variant
              </label>
              <Select name="variantId">
                <option value="">None</option>
                {variants.map((variant) => (
                  <option key={variant.id} value={variant.id}>
                    {variant.sku ?? variant.id} —{' '}
                    {variant.product?.title ?? 'Product'}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-text-muted mb-1 block text-xs font-medium">
                  Interval
                </label>
                <Select name="interval" defaultValue="month">
                  <option value="day">Day</option>
                  <option value="week">Week</option>
                  <option value="month">Month</option>
                  <option value="year">Year</option>
                </Select>
              </div>
              <div>
                <label className="text-text-muted mb-1 block text-xs font-medium">
                  Every
                </label>
                <Input
                  name="intervalCount"
                  type="number"
                  min="1"
                  defaultValue="1"
                />
              </div>
            </div>
            <Button type="submit">
              <PlusIcon className="mr-1.5 h-4 w-4" />
              Create plan
            </Button>
          </Form>
        </Card>

        <Card>
          <h2 className="text-text mb-4 text-sm font-semibold">Plans</h2>
          {plans.length === 0 ? (
            <p className="text-text-muted text-sm">
              No subscription plans yet.
            </p>
          ) : (
            <ul className="divide-border divide-y">
              {plans.map((plan) => (
                <li
                  key={plan.id}
                  className="flex items-center justify-between py-3 text-sm"
                >
                  <div>
                    <p className="text-text font-medium">{plan.name}</p>
                    <p className="text-text-muted text-xs">
                      Every {plan.intervalCount} {plan.interval}
                      {plan.variant?.sku ? ` · ${plan.variant.sku}` : ''}
                    </p>
                  </div>
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
    </div>
  );
}
