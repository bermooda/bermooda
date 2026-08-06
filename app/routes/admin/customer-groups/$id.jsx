import {
  Form,
  Link,
  useActionData,
  useLoaderData,
  useNavigation,
} from 'react-router';

import { listCustomers } from '#/core/customers/index.server';
import { useT } from '#/core/i18n';
import {
  addCustomerToGroup,
  getCustomerGroup,
  removeCustomerFromGroup,
} from '#/core/pricing/index.server';
import Badge from '#/components/admin/badge';
import Breadcrumbs from '#/components/admin/breadcrumbs';
import FormSection from '#/components/admin/form-section';
import Field from '#/components/admin/form/field';
import Select from '#/components/admin/form/select';
import PageHeader from '#/components/admin/page-header';
import { ErrorAlert, SuccessAlert } from '#/components/ui/alert';
import Button, { ButtonSubmit } from '#/components/ui/button';

export async function loader({ params }) {
  const [group, customersResult] = await Promise.all([
    getCustomerGroup(params.id),
    listCustomers({ limit: 100 }),
  ]);

  if (!group) {
    throw new Response('Customer group not found', { status: 404 });
  }

  return { group, customers: customersResult.customers };
}

export async function action({ request, params }) {
  const formData = await request.formData();
  const intent = formData.get('intent');
  const customerId = formData.get('customerId')?.toString();

  if (!customerId) {
    return { error: 'Customer is required.' };
  }

  try {
    if (intent === 'add-member') {
      await addCustomerToGroup(params.id, customerId);
      return { ok: true, intent };
    }

    if (intent === 'remove-member') {
      await removeCustomerFromGroup(params.id, customerId);
      return { ok: true, intent };
    }

    return { error: 'Unknown action.' };
  } catch (err) {
    return { error: err.message ?? 'Could not update members.' };
  }
}

export function meta({ loaderData }) {
  const name = loaderData?.group?.name ?? 'Customer group';
  return [{ title: `${name} — Customer groups` }];
}

export default function AdminCustomerGroupDetailRoute() {
  const t = useT();
  const { group, customers } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSaving = navigation.state === 'submitting';
  const memberIds = new Set(group.members.map((m) => m.customerId));
  const availableCustomers = customers.filter((c) => !memberIds.has(c.id));

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              {
                label: t('admin.customerGroups.detail.breadcrumb'),
                href: '/admin/customer-groups',
              },
              { label: group.name },
            ]}
          />
        }
        title={group.name}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            <Badge tone="accent" className="font-mono">
              {group.handle}
            </Badge>
            <span>
              {t('admin.customerGroups.detail.subtitle', {
                handle: group.handle,
                members: group._count.members,
                priceLists: group._count.priceLists,
              })}
            </span>
          </span>
        }
      />

      <ErrorAlert message={actionData?.error} />
      {actionData?.ok ? (
        <SuccessAlert
          message={t(
            actionData.intent === 'remove-member'
              ? 'admin.customerGroups.detail.memberRemoved'
              : 'admin.customerGroups.detail.memberAdded'
          )}
        />
      ) : null}

      <div className="space-y-12">
        <FormSection
          title={t('admin.customerGroups.detail.membersTitle')}
          description={t('admin.customerGroups.detail.membersDescription')}
          last
        >
          {group.members.length === 0 ? (
            <p className="text-text-muted mb-6 text-sm">
              {t('admin.customerGroups.detail.noMembers')}
            </p>
          ) : (
            <ul className="divide-border border-border mb-6 divide-y rounded-lg border text-sm">
              {group.members.map((row) => (
                <li
                  key={row.id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <span className="text-text">{row.customer.email}</span>
                  <Form method="post">
                    <input type="hidden" name="intent" value="remove-member" />
                    <input
                      type="hidden"
                      name="customerId"
                      value={row.customerId}
                    />
                    <Button type="submit" variant="secondary">
                      {t('admin.customerGroups.detail.remove')}
                    </Button>
                  </Form>
                </li>
              ))}
            </ul>
          )}

          <Form
            method="post"
            className="flex max-w-2xl flex-wrap items-end gap-3"
          >
            <input type="hidden" name="intent" value="add-member" />
            <Field
              label={t('admin.customerGroups.detail.customer')}
              htmlFor="group-customer"
              className="min-w-0 flex-1"
            >
              <Select
                id="group-customer"
                name="customerId"
                required
                disabled={availableCustomers.length === 0}
              >
                <option value="">
                  {availableCustomers.length === 0
                    ? t('admin.customerGroups.detail.noCustomersAvailable')
                    : t('admin.customerGroups.detail.selectCustomer')}
                </option>
                {availableCustomers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.email}
                  </option>
                ))}
              </Select>
            </Field>
            <ButtonSubmit
              disabled={isSaving || availableCustomers.length === 0}
            >
              {isSaving
                ? t('admin.customerGroups.detail.adding')
                : t('admin.customerGroups.detail.addMember')}
            </ButtonSubmit>
          </Form>
        </FormSection>
      </div>

      <div className="mt-6 mb-6 flex items-center justify-between gap-x-6">
        <span />
        <Link
          to="/admin/customer-groups"
          className="text-text text-sm/6 font-semibold transition-colors hover:opacity-80"
        >
          {t('admin.customerGroups.detail.backToGroups')}
        </Link>
      </div>
    </div>
  );
}
