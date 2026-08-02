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
  createPriceList,
  listCustomerGroups,
} from '#/core/pricing/index.server';
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
  const name = formData.get('name')?.toString().trim();
  const currency = formData.get('currency')?.toString().trim().toUpperCase();
  const customerGroupId = formData.get('customerGroupId')?.toString() || null;
  const priority = parseInt(formData.get('priority')?.toString() ?? '0', 10);

  if (!name || !currency) {
    return { error: 'Name and currency are required.' };
  }

  await createPriceList({
    name,
    currency,
    customerGroupId: customerGroupId || null,
    priority,
    active: true,
  });

  return redirect('/admin/price-lists');
}

export default function AdminNewPriceListRoute() {
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
                label: t('admin.priceLists.index.title'),
                href: '/admin/price-lists',
              },
              { label: t('admin.priceLists.new.breadcrumb') },
            ]}
          />
        }
        title={t('admin.priceLists.new.title')}
        subtitle={t('admin.priceLists.new.subtitle')}
      />

      <ErrorAlert message={actionData?.error} />

      <Form method="post" className="space-y-6">
        <Card>
          <CardHeader
            title={t('admin.priceLists.new.cardTitle')}
            description={t('admin.priceLists.new.cardDescription')}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t('admin.priceLists.new.name')}
              htmlFor="price-list-name"
            >
              <Input
                id="price-list-name"
                name="name"
                required
                placeholder={t('admin.priceLists.new.namePlaceholder')}
              />
            </Field>
            <Field
              label={t('admin.priceLists.new.currency')}
              htmlFor="price-list-currency"
            >
              <Input
                id="price-list-currency"
                name="currency"
                required
                defaultValue="USD"
                maxLength={3}
                className="uppercase"
              />
            </Field>
            <Field
              label={t('admin.priceLists.new.customerGroup')}
              htmlFor="price-list-group"
            >
              <Select
                id="price-list-group"
                name="customerGroupId"
                defaultValue=""
              >
                <option value="">
                  {t('admin.priceLists.new.allCustomers')}
                </option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label={t('admin.priceLists.new.priority')}
              htmlFor="price-list-priority"
            >
              <Input
                id="price-list-priority"
                name="priority"
                type="number"
                defaultValue="0"
              />
            </Field>
          </div>
        </Card>

        <ActionBar>
          <span />
          <div className="flex items-center gap-3">
            <Link
              to="/admin/price-lists"
              className="text-text-muted hover:text-text text-sm transition-colors"
            >
              {t('common.cancel')}
            </Link>
            <ButtonSubmit disabled={isSaving}>
              {isSaving
                ? t('admin.priceLists.new.creating')
                : t('admin.priceLists.new.create')}
            </ButtonSubmit>
          </div>
        </ActionBar>
      </Form>
    </div>
  );
}
