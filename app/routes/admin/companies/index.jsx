// app/routes/admin/companies/index.jsx
// B2B company accounts list.

import { PlusIcon } from '@heroicons/react/24/outline';
import { Link, useLoaderData } from 'react-router';

import { loadCompanyAdminIndexData } from '#/core/b2b/index.server';
import { useT } from '#/core/i18n';
import Card from '#/components/admin/card';
import PageHeader from '#/components/admin/page-header';

export async function loader() {
  return loadCompanyAdminIndexData();
}

export default function AdminCompaniesRoute() {
  const t = useT();
  const { companies } = useLoaderData();

  return (
    <div>
      <PageHeader
        title={t('admin.companies.index.title')}
        subtitle={t('admin.companies.index.subtitle')}
        actions={
          <div className="flex items-center gap-3">
            <Link
              to="/admin/quotes"
              className="text-text-muted hover:text-text text-sm font-medium"
            >
              {t('admin.companies.index.viewQuotes')}
            </Link>
            <Link
              to="/admin/companies/new"
              className="bg-accent text-accent-fg hover:bg-accent-hover focus-visible:outline-accent inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-semibold shadow-sm transition focus-visible:outline focus-visible:outline-offset-2"
            >
              <PlusIcon className="h-4 w-4" />
              {t('admin.companies.index.newButton')}
            </Link>
          </div>
        }
        className="mb-6"
      />

      <Card>
        <h2 className="text-text mb-4 text-sm font-semibold">
          {t('admin.companies.index.heading')}
        </h2>
        {companies.length === 0 ? (
          <p className="text-text-muted text-sm">
            {t('admin.companies.index.empty')}{' '}
            <Link
              to="/admin/companies/new"
              className="text-accent hover:underline"
            >
              {t('admin.companies.index.createFirst')}
            </Link>
            .
          </p>
        ) : (
          <ul className="divide-border divide-y">
            {companies.map((company) => (
              <li key={company.id} className="py-4">
                <Link
                  to={`/admin/companies/${company.id}`}
                  className="hover:text-accent block"
                >
                  <p className="text-text font-medium">{company.name}</p>
                  <p className="text-text-muted text-xs">
                    {t('admin.companies.index.meta', {
                      days: company.netTermsDays,
                      members: company.memberCount ?? 0,
                      quotes: company.quoteCount ?? 0,
                    })}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
