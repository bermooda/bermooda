import {
  Form,
  Link,
  redirect,
  useActionData,
  useLoaderData,
  useNavigation,
} from 'react-router';

import { useT } from '#/core/i18n';
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
  const t = useT();
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
              {
                label: t('admin.subscriptions.new.breadcrumb'),
                href: '/admin/subscriptions',
              },
              { label: t('admin.subscriptions.index.newButton') },
            ]}
          />
        }
        title={t('admin.subscriptions.new.title')}
        subtitle={t('admin.subscriptions.new.subtitle')}
      />

      <ErrorAlert message={actionData?.error} />

      <Form method="post" className="space-y-6">
        <Card>
          <CardHeader
            title={t('admin.subscriptions.new.cardTitle')}
            description={t('admin.subscriptions.new.cardDescription')}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t('admin.subscriptions.new.name')}
              htmlFor="plan-name"
            >
              <Input
                id="plan-name"
                name="name"
                required
                placeholder={t('admin.subscriptions.new.namePlaceholder')}
              />
            </Field>
            <Field
              label={t('admin.subscriptions.new.variant')}
              htmlFor="plan-variant"
            >
              <Select id="plan-variant" name="variantId">
                <option value="">
                  {t('admin.subscriptions.new.variantNone')}
                </option>
                {variants.map((variant) => (
                  <option key={variant.id} value={variant.id}>
                    {variant.sku ?? variant.id} —{' '}
                    {variant.product?.title ??
                      t('admin.subscriptions.new.productFallback')}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label={t('admin.subscriptions.new.interval')}
              htmlFor="plan-interval"
            >
              <Select id="plan-interval" name="interval" defaultValue="month">
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
              label={t('admin.subscriptions.new.every')}
              htmlFor="plan-interval-count"
            >
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
              {t('common.cancel')}
            </Link>
            <ButtonSubmit disabled={isSaving}>
              {isSaving
                ? t('admin.subscriptions.new.creating')
                : t('admin.subscriptions.new.create')}
            </ButtonSubmit>
          </div>
        </ActionBar>
      </Form>
    </div>
  );
}
