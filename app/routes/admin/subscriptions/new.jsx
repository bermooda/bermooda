import {
  Form,
  Link,
  redirect,
  useActionData,
  useLoaderData,
  useNavigation,
} from 'react-router';

import { listRecentVariantsForInventory } from '#/core/inventory/index.server';
import {
  createSubscriptionPlan,
  parseCreatePlanFromForm,
} from '#/core/subscriptions/index.server';
import ActionBar from '#/components/admin/action-bar';
import Breadcrumbs from '#/components/admin/breadcrumbs';
import Card, { CardHeader } from '#/components/admin/card';
import Field from '#/components/admin/form/field';
import Input from '#/components/admin/form/input';
import Select from '#/components/admin/form/select';
import PageHeader from '#/components/admin/page-header';
import { ErrorAlert } from '#/components/ui/alert';
import { ButtonSubmit } from '#/components/ui/button';

export async function loader() {
  const variants = await listRecentVariantsForInventory({ take: 50 });
  return { variants };
}

export async function action({ request }) {
  const formData = await request.formData();

  try {
    const plan = await createSubscriptionPlan(
      parseCreatePlanFromForm(formData)
    );
    return redirect(`/admin/subscriptions/${plan.id}`);
  } catch (err) {
    return { error: err.message ?? 'Could not create plan.' };
  }
}

export function meta() {
  return [{ title: 'New plan — Subscriptions' }];
}

export default function AdminNewSubscriptionPlanRoute() {
  const { variants } = useLoaderData();
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
              { label: 'New plan' },
            ]}
          />
        }
        title="New subscription plan"
        subtitle="Create a recurring billing plan."
      />

      <ErrorAlert message={actionData?.error} />

      <Form method="post" className="space-y-6">
        <Card>
          <CardHeader
            title="Plan details"
            description="Name and billing interval. Variant is optional."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name *" htmlFor="plan-name">
              <Input
                id="plan-name"
                name="name"
                required
                placeholder="Monthly coffee box"
              />
            </Field>
            <Field label="Product variant" htmlFor="plan-variant">
              <Select id="plan-variant" name="variantId">
                <option value="">None</option>
                {variants.map((variant) => (
                  <option key={variant.id} value={variant.id}>
                    {variant.sku ?? variant.id} —{' '}
                    {variant.product?.title ?? 'Product'}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Interval" htmlFor="plan-interval">
              <Select id="plan-interval" name="interval" defaultValue="month">
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
                defaultValue="1"
              />
            </Field>
          </div>
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
              {isSaving ? 'Creating…' : 'Create plan'}
            </ButtonSubmit>
          </div>
        </ActionBar>
      </Form>
    </div>
  );
}
