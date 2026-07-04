// app/routes/admin/companies/index.jsx
// B2B company accounts admin.

import { PlusIcon } from '@heroicons/react/24/outline';
import { Form, Link, useLoaderData } from 'react-router';

import prisma from '#/libs/prisma.server';
import Card from '#/components/admin/card';
import Input from '#/components/admin/form/input';
import Select from '#/components/admin/form/select';
import PageHeader from '#/components/admin/page-header';
import Button from '#/components/ui/button';

import {
  addCompanyMember,
  createCompany,
  listCompanies,
} from '#/core/b2b/index.server';

export async function loader() {
  const [companies, customers] = await Promise.all([
    listCompanies(),
    prisma.customer.findMany({
      take: 100,
      orderBy: { createdAt: 'desc' },
      select: { id: true, email: true, name: true },
    }),
  ]);

  return { companies, customers };
}

export async function action({ request }) {
  const formData = await request.formData();
  const intent = formData.get('intent');

  if (intent === 'create-company') {
    const name = formData.get('name')?.toString().trim();
    const taxId = formData.get('taxId')?.toString().trim() || null;
    const netTermsDays = parseInt(
      formData.get('netTermsDays')?.toString() ?? '30',
      10
    );

    if (!name) return { ok: false, error: 'Company name is required.' };

    await createCompany({
      name,
      taxId,
      netTermsDays: Number.isNaN(netTermsDays) ? 30 : netTermsDays,
    });

    return { ok: true };
  }

  if (intent === 'add-member') {
    const companyId = formData.get('companyId')?.toString();
    const customerId = formData.get('customerId')?.toString();
    if (!companyId || !customerId) {
      return { ok: false, error: 'Company and customer are required.' };
    }
    await addCompanyMember(companyId, customerId);
    return { ok: true };
  }

  return { ok: false, error: 'Unknown action.' };
}

export default function AdminCompaniesRoute() {
  const { companies, customers } = useLoaderData();

  return (
    <div>
      <PageHeader
        title="B2B companies"
        subtitle="Company accounts for shared purchasing and net terms."
        actions={
          <Link
            to="/admin/quotes"
            className="text-text-muted hover:text-text text-sm font-medium"
          >
            View quotes →
          </Link>
        }
        className="mb-6"
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="text-text mb-4 text-sm font-semibold">New company</h2>
          <Form method="post" className="space-y-4">
            <input type="hidden" name="intent" value="create-company" />
            <div>
              <label className="text-text-muted mb-1 block text-xs font-medium">
                Name
              </label>
              <Input name="name" required placeholder="Acme Corp" />
            </div>
            <div>
              <label className="text-text-muted mb-1 block text-xs font-medium">
                Tax ID
              </label>
              <Input name="taxId" placeholder="Optional" />
            </div>
            <div>
              <label className="text-text-muted mb-1 block text-xs font-medium">
                Net terms (days)
              </label>
              <Input
                name="netTermsDays"
                type="number"
                min="0"
                defaultValue="30"
              />
            </div>
            <Button type="submit">
              <PlusIcon className="mr-1.5 h-4 w-4" />
              Create company
            </Button>
          </Form>
        </Card>

        <Card>
          <h2 className="text-text mb-4 text-sm font-semibold">Companies</h2>
          {companies.length === 0 ? (
            <p className="text-text-muted text-sm">No companies yet.</p>
          ) : (
            <ul className="divide-border divide-y">
              {companies.map((company) => (
                <li key={company.id} className="py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-text font-medium">{company.name}</p>
                      <p className="text-text-muted text-xs">
                        Net {company.netTermsDays} days ·{' '}
                        {company._count.members} member(s) ·{' '}
                        {company._count.quotes} quote(s)
                      </p>
                    </div>
                  </div>
                  <Form method="post" className="mt-3 flex gap-2">
                    <input type="hidden" name="intent" value="add-member" />
                    <input type="hidden" name="companyId" value={company.id} />
                    <Select name="customerId" className="flex-1">
                      <option value="">Add customer…</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.email}
                        </option>
                      ))}
                    </Select>
                    <Button type="submit" variant="secondary">
                      Add
                    </Button>
                  </Form>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
