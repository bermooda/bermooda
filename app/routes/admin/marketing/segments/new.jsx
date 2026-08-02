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
  createSegment,
  parseCreateSegmentInput,
  parseSegmentRulesFromForm,
} from '#/core/marketing/index.server';
import { listCustomerGroups } from '#/core/pricing/index.server';
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
  const groups = await listCustomerGroups();
  return { groups };
}

export async function action({ request }) {
  const formData = await request.formData();
  try {
    await createSegment(
      parseCreateSegmentInput({
        name: formData.get('name'),
        rules: parseSegmentRulesFromForm(formData),
      })
    );
    return redirect('/admin/marketing');
  } catch (err) {
    if (err.code === 'NAME_REQUIRED') {
      return { error: err.message };
    }
    throw err;
  }
}

export default function AdminNewMarketingSegmentRoute() {
  const t = useT();
  const { groups } = useLoaderData();
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
                label: t('admin.marketing.segmentsNew.breadcrumb'),
                href: '/admin/marketing',
              },
              { label: t('admin.marketing.segmentsNew.title') },
            ]}
          />
        }
        title={t('admin.marketing.segmentsNew.title')}
        subtitle={t('admin.marketing.segmentsNew.subtitle')}
      />

      <ErrorAlert message={actionData?.error} />

      <Form method="post" className="space-y-6">
        <Card>
          <CardHeader
            title={t('admin.marketing.segmentsNew.cardTitle')}
            description={t('admin.marketing.segmentsNew.cardDescription')}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t('admin.marketing.segmentsNew.name')}
              htmlFor="segment-name"
            >
              <Input
                id="segment-name"
                name="name"
                required
                placeholder={t('admin.marketing.segmentsNew.namePlaceholder')}
              />
            </Field>
            <Field
              label={t('admin.marketing.segmentsNew.minOrders')}
              htmlFor="segment-min-orders"
            >
              <Input
                id="segment-min-orders"
                name="minOrders"
                type="number"
                min="0"
                placeholder={t(
                  'admin.marketing.segmentsNew.minOrdersPlaceholder'
                )}
              />
            </Field>
            <Field
              label={t('admin.marketing.segmentsNew.minSpent')}
              htmlFor="segment-min-spent"
            >
              <Input
                id="segment-min-spent"
                name="minSpentCents"
                type="number"
                min="0"
                placeholder={t(
                  'admin.marketing.segmentsNew.minSpentPlaceholder'
                )}
              />
            </Field>
            <Field
              label={t('admin.marketing.segmentsNew.customerGroup')}
              htmlFor="segment-group"
            >
              <Select id="segment-group" name="customerGroupId" defaultValue="">
                <option value="">
                  {t('admin.marketing.segmentsNew.anyGroup')}
                </option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </Card>

        <ActionBar>
          <span />
          <div className="flex items-center gap-3">
            <Link
              to="/admin/marketing"
              className="text-text-muted hover:text-text text-sm transition-colors"
            >
              {t('common.cancel')}
            </Link>
            <ButtonSubmit disabled={isSaving}>
              {isSaving
                ? t('admin.marketing.segmentsNew.creating')
                : t('admin.marketing.segmentsNew.createButton')}
            </ButtonSubmit>
          </div>
        </ActionBar>
      </Form>
    </div>
  );
}
