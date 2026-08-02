import {
  Form,
  Link,
  useActionData,
  useLoaderData,
  useNavigation,
} from 'react-router';

import {
  addCompanyMember,
  getCompany,
  listCustomersForCompanyForm,
  parseAddCompanyMemberForm,
} from '#/core/b2b/index.server';
import { useT } from '#/core/i18n';
import ActionBar from '#/components/admin/action-bar';
import Breadcrumbs from '#/components/admin/breadcrumbs';
import Card, { CardHeader } from '#/components/admin/card';
import Field from '#/components/admin/form/field';
import Select from '#/components/admin/form/select';
import PageHeader from '#/components/admin/page-header';
import { ErrorAlert, SuccessAlert } from '#/components/ui/alert';
import Button, { ButtonSubmit } from '#/components/ui/button';

export async function loader({ params }) {
  try {
    const [company, customers] = await Promise.all([
      getCompany(params.id),
      listCustomersForCompanyForm(),
    ]);
    return { company, customers };
  } catch (err) {
    if (err.code === 'NOT_FOUND' || err.status === 404) {
      throw new Response('Company not found', { status: 404 });
    }
    throw err;
  }
}

export async function action({ request }) {
  const formData = await request.formData();
  const intent = formData.get('intent');

  try {
    if (intent === 'add-member') {
      await addCompanyMember(parseAddCompanyMemberForm(formData));
      return { ok: true };
    }
    return { error: 'Unknown action.' };
  } catch (err) {
    return { error: err.message ?? 'Could not update company.' };
  }
}

export function meta({ loaderData }) {
  const name = loaderData?.company?.name ?? 'Company';
  return [{ title: `${name} — Companies` }];
}

export default function AdminCompanyDetailRoute() {
  const t = useT();
  const { company, customers } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSaving = navigation.state === 'submitting';
  const memberCustomerIds = new Set(
    (company.members ?? []).map((m) => m.customer?.id).filter(Boolean)
  );
  const availableCustomers = customers.filter(
    (c) => !memberCustomerIds.has(c.id)
  );

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              {
                label: t('admin.companies.detail.breadcrumb'),
                href: '/admin/companies',
              },
              { label: company.name },
            ]}
          />
        }
        title={company.name}
        subtitle={t('admin.companies.detail.subtitle', {
          days: company.netTermsDays,
          members: company.memberCount ?? 0,
          quotes: company.quoteCount ?? 0,
        })}
        actions={
          <Button as={Link} to="/admin/companies" variant="secondary">
            {t('admin.companies.detail.back')}
          </Button>
        }
      />

      <ErrorAlert message={actionData?.error} />
      {actionData?.ok && (
        <SuccessAlert message={t('admin.companies.detail.memberAdded')} />
      )}

      <div className="mt-6 space-y-6">
        <Card>
          <CardHeader
            title={t('admin.companies.detail.detailsTitle')}
            description={
              company.taxId
                ? t('admin.companies.detail.taxIdSet', { taxId: company.taxId })
                : t('admin.companies.detail.noTaxId')
            }
          />
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-text-muted">
                {t('admin.companies.detail.status')}
              </dt>
              <dd className="text-text font-medium">
                {company.active
                  ? t('admin.companies.detail.active')
                  : t('admin.companies.detail.inactive')}
              </dd>
            </div>
            <div>
              <dt className="text-text-muted">
                {t('admin.companies.detail.netTerms')}
              </dt>
              <dd className="text-text font-medium">
                {t('admin.companies.detail.netTermsValue', {
                  days: company.netTermsDays,
                })}
              </dd>
            </div>
            <div>
              <dt className="text-text-muted">
                {t('admin.companies.detail.taxId')}
              </dt>
              <dd className="text-text font-medium">{company.taxId || '—'}</dd>
            </div>
          </dl>
        </Card>

        <Card>
          <CardHeader
            title={t('admin.companies.detail.membersTitle')}
            description={t('admin.companies.detail.membersDescription')}
          />
          {(company.members ?? []).length === 0 ? (
            <p className="text-text-muted text-sm">
              {t('admin.companies.detail.noMembers')}
            </p>
          ) : (
            <ul className="divide-border mb-4 divide-y text-sm">
              {(company.members ?? []).map((member) => (
                <li key={member.id} className="flex justify-between py-2">
                  <span className="text-text">
                    {member.customer?.email ?? member.id}
                  </span>
                  <span className="text-text-muted uppercase">
                    {member.role}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <Form method="post" className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="intent" value="add-member" />
            <input type="hidden" name="companyId" value={company.id} />
            <Field
              label={t('admin.companies.detail.customer')}
              htmlFor="member-customer"
              className="flex-1"
            >
              <Select
                id="member-customer"
                name="customerId"
                required
                disabled={availableCustomers.length === 0}
              >
                <option value="">
                  {availableCustomers.length === 0
                    ? t('admin.companies.detail.noCustomersAvailable')
                    : t('admin.companies.detail.selectCustomer')}
                </option>
                {availableCustomers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.email}
                  </option>
                ))}
              </Select>
            </Field>
            <ButtonSubmit
              disabled={isSaving || availableCustomers.length === 0}
            >
              {isSaving
                ? t('admin.companies.detail.adding')
                : t('admin.companies.detail.addMember')}
            </ButtonSubmit>
          </Form>
        </Card>

        <ActionBar>
          <span />
          <Link
            to="/admin/companies"
            className="text-text-muted hover:text-text text-sm transition-colors"
          >
            {t('admin.companies.detail.backToCompanies')}
          </Link>
        </ActionBar>
      </div>
    </div>
  );
}
