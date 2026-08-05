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
import Badge from '#/components/admin/badge';
import Breadcrumbs from '#/components/admin/breadcrumbs';
import FormSection from '#/components/admin/form-section';
import Field from '#/components/admin/form/field';
import Select from '#/components/admin/form/select';
import PageHeader from '#/components/admin/page-header';
import { ErrorAlert, SuccessAlert } from '#/components/ui/alert';
import { ButtonSubmit } from '#/components/ui/button';

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
    <div className="mx-auto max-w-5xl">
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
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            <Badge tone={company.active ? 'success' : 'neutral'}>
              {company.active
                ? t('admin.companies.detail.active')
                : t('admin.companies.detail.inactive')}
            </Badge>
            <span>
              {t('admin.companies.detail.subtitle', {
                days: company.netTermsDays,
                members: company.memberCount ?? 0,
                quotes: company.quoteCount ?? 0,
              })}
            </span>
          </span>
        }
      />

      <ErrorAlert message={actionData?.error} />
      {actionData?.ok ? (
        <SuccessAlert message={t('admin.companies.detail.memberAdded')} />
      ) : null}

      <div className="space-y-12">
        <FormSection
          title={t('admin.companies.detail.detailsTitle')}
          description={
            company.taxId
              ? t('admin.companies.detail.taxIdSet', { taxId: company.taxId })
              : t('admin.companies.detail.noTaxId')
          }
        >
          <dl className="grid max-w-2xl gap-6 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-text-muted">
                {t('admin.companies.detail.status')}
              </dt>
              <dd className="text-text mt-1 font-medium">
                {company.active
                  ? t('admin.companies.detail.active')
                  : t('admin.companies.detail.inactive')}
              </dd>
            </div>
            <div>
              <dt className="text-text-muted">
                {t('admin.companies.detail.netTerms')}
              </dt>
              <dd className="text-text mt-1 font-medium tabular-nums">
                {t('admin.companies.detail.netTermsValue', {
                  days: company.netTermsDays,
                })}
              </dd>
            </div>
            <div>
              <dt className="text-text-muted">
                {t('admin.companies.detail.taxId')}
              </dt>
              <dd className="text-text mt-1 font-medium">
                {company.taxId || '—'}
              </dd>
            </div>
          </dl>
        </FormSection>

        <FormSection
          title={t('admin.companies.detail.membersTitle')}
          description={t('admin.companies.detail.membersDescription')}
          last
        >
          {(company.members ?? []).length === 0 ? (
            <p className="text-text-muted mb-6 text-sm">
              {t('admin.companies.detail.noMembers')}
            </p>
          ) : (
            <ul className="divide-border border-border mb-6 divide-y rounded-lg border text-sm">
              {(company.members ?? []).map((member) => (
                <li
                  key={member.id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <span className="text-text">
                    {member.customer?.email ?? member.id}
                  </span>
                  <span className="text-text-muted text-xs font-medium tracking-wide uppercase">
                    {member.role}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <Form
            method="post"
            className="flex max-w-2xl flex-wrap items-end gap-3"
          >
            <input type="hidden" name="intent" value="add-member" />
            <input type="hidden" name="companyId" value={company.id} />
            <Field
              label={t('admin.companies.detail.customer')}
              htmlFor="member-customer"
              className="min-w-0 flex-1"
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
        </FormSection>
      </div>

      <div className="mt-6 mb-6 flex items-center justify-between gap-x-6">
        <span />
        <Link
          to="/admin/companies"
          className="text-text text-sm/6 font-semibold transition-colors hover:opacity-80"
        >
          {t('admin.companies.detail.backToCompanies')}
        </Link>
      </div>
    </div>
  );
}
