import {
  Form,
  Link,
  redirect,
  useActionData,
  useLoaderData,
  useNavigation,
} from 'react-router';

import { useT } from '#/core/i18n';
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
  const t = useT();
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
              {
                label: t('admin.subscriptions.edit.breadcrumb'),
                href: '/admin/subscriptions',
              },
              { label: plan.name },
            ]}
          />
        }
        title={plan.name}
        subtitle={t('admin.subscriptions.edit.subtitle')}
        actions={
          <Badge tone={plan.active ? 'success' : 'neutral'}>
            {plan.active
              ? t('admin.subscriptions.status.active')
              : t('admin.subscriptions.status.inactive')}
          </Badge>
        }
      />

      <ErrorAlert message={actionData?.error} />

      <Form method="post" className="space-y-6">
        <Card>
          <CardHeader title={t('admin.subscriptions.edit.cardTitle')} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t('admin.subscriptions.edit.name')}
              htmlFor="plan-name"
            >
              <Input
                id="plan-name"
                name="name"
                required
                defaultValue={plan.name}
              />
            </Field>
            <Field
              label={t('admin.subscriptions.edit.interval')}
              htmlFor="plan-interval"
            >
              <Select
                id="plan-interval"
                name="interval"
                defaultValue={plan.interval}
              >
                <option value="day">
                  {t('admin.subscriptions.new.intervalDay')}
                </option>
                <option value="week">
                  {t('admin.subscriptions.new.intervalWeek')}
                </option>
                <option value="month">
                  {t('admin.subscriptions.new.intervalMonth')}
                </option>
                <option value="year">
                  {t('admin.subscriptions.new.intervalYear')}
                </option>
              </Select>
            </Field>
            <Field
              label={t('admin.subscriptions.edit.every')}
              htmlFor="plan-interval-count"
            >
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
              {t('admin.subscriptions.edit.active')}
            </label>
          </div>
          {plan.variant?.sku && (
            <p className="text-text-muted mt-4 text-sm">
              {t('admin.subscriptions.edit.linkedVariant', {
                sku: plan.variant.sku,
              })}
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
              {t('common.cancel')}
            </Link>
            <ButtonSubmit disabled={isSaving}>
              {isSaving
                ? t('admin.subscriptions.edit.saving')
                : t('admin.subscriptions.edit.save')}
            </ButtonSubmit>
          </div>
        </ActionBar>
      </Form>
    </div>
  );
}
