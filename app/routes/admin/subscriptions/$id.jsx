import {
  Form,
  Link,
  redirect,
  useActionData,
  useLoaderData,
  useNavigation,
} from 'react-router';

import {
  getSubscriptionPlan,
  parseUpdatePlanInput,
  updateSubscriptionPlan,
} from '#/core/subscriptions/index.server';
import ActionBar from '#/components/admin/action-bar';
import Badge from '#/components/admin/badge';
import Breadcrumbs from '#/components/admin/breadcrumbs';
import Card, { CardHeader } from '#/components/admin/card';
import Field from '#/components/admin/form/field';
import Input from '#/components/admin/form/input';
import Select from '#/components/admin/form/select';
import PageHeader from '#/components/admin/page-header';
import { ErrorAlert } from '#/components/ui/alert';
import { ButtonSubmit } from '#/components/ui/button';

export async function loader({ params }) {
  try {
    const plan = await getSubscriptionPlan(params.id);
    return { plan };
  } catch (err) {
    if (err.code === 'NOT_FOUND' || err.status === 404) {
      throw new Response('Plan not found', { status: 404 });
    }
    throw err;
  }
}

export async function action({ request, params }) {
  const formData = await request.formData();

  try {
    const input = parseUpdatePlanInput({
      name: formData.get('name'),
      interval: formData.get('interval'),
      intervalCount: formData.get('intervalCount'),
      active: formData.get('active') === 'on',
    });
    await updateSubscriptionPlan(params.id, input);
    return redirect('/admin/subscriptions');
  } catch (err) {
    return { error: err.message ?? 'Could not save plan.' };
  }
}

export function meta({ loaderData }) {
  const name = loaderData?.plan?.name ?? 'Edit plan';
  return [{ title: `${name} — Subscriptions` }];
}

export default function AdminEditSubscriptionPlanRoute() {
  const { plan } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSaving = navigation.state === 'submitting';

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Subscriptions', href: '/admin/subscriptions' },
              { label: plan.name },
            ]}
          />
        }
        title={plan.name}
        subtitle="Update plan name, interval, and active status."
        actions={
          <Badge tone={plan.active ? 'success' : 'neutral'}>
            {plan.active ? 'Active' : 'Inactive'}
          </Badge>
        }
      />

      <ErrorAlert message={actionData?.error} />

      <Form method="post" className="space-y-6">
        <Card>
          <CardHeader title="Plan details" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name *" htmlFor="plan-name">
              <Input
                id="plan-name"
                name="name"
                required
                defaultValue={plan.name}
              />
            </Field>
            <Field label="Interval" htmlFor="plan-interval">
              <Select
                id="plan-interval"
                name="interval"
                defaultValue={plan.interval}
              >
                <option value="day">Day</option>
                <option value="week">Week</option>
                <option value="month">Month</option>
                <option value="year">Year</option>
              </Select>
            </Field>
            <Field label="Every" htmlFor="plan-interval-count">
              <Input
                id="plan-interval-count"
                name="intervalCount"
                type="number"
                min="1"
                defaultValue={plan.intervalCount}
              />
            </Field>
            <label className="flex items-center gap-2 self-end text-sm">
              <input
                type="checkbox"
                name="active"
                defaultChecked={Boolean(plan.active)}
              />
              Active
            </label>
          </div>
          {plan.variant?.sku && (
            <p className="text-text-muted mt-4 text-sm">
              Linked variant: {plan.variant.sku}
            </p>
          )}
        </Card>

        <ActionBar>
          <span />
          <div className="flex items-center gap-3">
            <Link
              to="/admin/subscriptions"
              className="text-text-muted hover:text-text text-sm transition-colors"
            >
              Cancel
            </Link>
            <ButtonSubmit disabled={isSaving}>
              {isSaving ? 'Saving…' : 'Save plan'}
            </ButtonSubmit>
          </div>
        </ActionBar>
      </Form>
    </div>
  );
}
