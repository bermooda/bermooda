// app/routes/admin/customers/index.jsx
// Customers admin list — paginated table with email/name search and inline create panel.

import {
  MagnifyingGlassIcon,
  PlusIcon,
  UserGroupIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useState } from 'react';
import {
  Form,
  Link,
  redirect,
  useActionData,
  useLoaderData,
  useNavigate,
  useSearchParams,
} from 'react-router';

import { containsFilter } from '#/utils/prisma-filters.server';
import prisma from '#/libs/prisma.server';
import Card from '#/components/admin/card';
import EmptyState from '#/components/admin/empty-state';
import Field from '#/components/admin/form/field';
import Input, { controlClasses } from '#/components/admin/form/input';
import PageHeader from '#/components/admin/page-header';
import Pagination from '#/components/admin/pagination';
import Stat from '#/components/admin/stat';
import Table, { TBody, Td, Th, THead, Tr } from '#/components/admin/table';
import Toolbar, { ToolbarGroup } from '#/components/admin/toolbar';
import { ErrorAlert } from '#/components/ui/alert';
import Button, { ButtonSubmit } from '#/components/ui/button';

const PAGE_SIZE = 20;

export async function loader({ request }) {
  const url = new URL(request.url);
  const rawPage = parseInt(url.searchParams.get('page') ?? '1', 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const q = url.searchParams.get('q')?.trim() ?? '';

  const where = q
    ? {
        OR: [{ email: containsFilter(q) }, { name: containsFilter(q) }],
      }
    : {};

  const [total, withOrdersCount, customers] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.count({
      where: {
        ...where,
        orders: { some: {} },
      },
    }),
    prisma.customer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        createdAt: true,
        _count: { select: { orders: true } },
      },
    }),
  ]);

  const rows = customers.map((c) => ({
    id: c.id,
    email: c.email,
    name: c.name ?? null,
    phone: c.phone ?? null,
    orderCount: c._count.orders,
    createdAt: c.createdAt.toISOString(),
  }));

  return {
    rows,
    total,
    withOrdersCount,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.ceil(total / PAGE_SIZE),
    q,
  };
}

export async function action({ request }) {
  const formData = await request.formData();
  const intent = formData.get('intent');

  if (intent === 'create') {
    const email = formData.get('email')?.toString().trim() ?? '';
    const name = formData.get('name')?.toString().trim() || null;
    const phone = formData.get('phone')?.toString().trim() || null;

    if (!email) {
      return { ok: false, error: 'Email is required.' };
    }

    const existing = await prisma.customer.findUnique({ where: { email } });
    if (existing) {
      return { ok: false, error: 'A customer with that email already exists.' };
    }

    const customer = await prisma.customer.create({
      data: { email, name, phone },
    });

    return redirect(`/admin/customers/${customer.id}`);
  }

  return { ok: false, error: 'Unknown intent.' };
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function AdminCustomersRoute() {
  const { rows, total, withOrdersCount, page, totalPages, q } = useLoaderData();
  const actionData = useActionData();
  const [, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);

  function goToPage(p) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('page', String(p));
      return next;
    });
  }

  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle="Manage customer profiles, addresses, and order history."
        actions={
          <button
            type="button"
            onClick={() => setShowCreate((v) => !v)}
            className="bg-accent text-accent-fg hover:bg-accent-hover focus-visible:outline-accent inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-semibold shadow-sm transition focus-visible:outline focus-visible:outline-offset-2"
          >
            {showCreate ? (
              <>
                <XMarkIcon className="h-4 w-4" />
                Cancel
              </>
            ) : (
              <>
                <PlusIcon className="h-4 w-4" />
                New customer
              </>
            )}
          </button>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <Stat label="Total customers" value={total} />
        <Stat label="With orders" value={withOrdersCount} />
      </div>

      {showCreate && (
        <Card className="mb-6">
          <h2 className="text-text mb-4 text-sm font-semibold">New customer</h2>
          <ErrorAlert message={actionData?.error} />
          <Form method="post" className="grid gap-4 sm:grid-cols-3">
            <input type="hidden" name="intent" value="create" />
            <Field
              label="Email *"
              htmlFor="customer-email"
              className="space-y-1"
            >
              <Input
                id="customer-email"
                type="email"
                name="email"
                required
                placeholder="customer@example.com"
              />
            </Field>
            <Field label="Name" htmlFor="customer-name" className="space-y-1">
              <Input
                id="customer-name"
                type="text"
                name="name"
                placeholder="Jane Doe"
              />
            </Field>
            <Field label="Phone" htmlFor="customer-phone" className="space-y-1">
              <Input
                id="customer-phone"
                type="tel"
                name="phone"
                placeholder="+1 555 000 0000"
              />
            </Field>
            <div className="flex gap-3 sm:col-span-3">
              <ButtonSubmit>Create customer</ButtonSubmit>
              <Button variant="secondary" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
            </div>
          </Form>
        </Card>
      )}

      <div className="border-border bg-surface overflow-hidden rounded-xl border shadow-xs">
        <Toolbar>
          <Form method="get" className="w-full sm:max-w-sm">
            <div className="relative">
              <MagnifyingGlassIcon className="text-text-muted pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <input
                type="search"
                name="q"
                defaultValue={q}
                placeholder="Search by email or name…"
                className={`${controlClasses} pl-9`}
              />
            </div>
          </Form>
          <ToolbarGroup>
            <span className="text-text-muted text-sm">
              {total} result{total !== 1 ? 's' : ''}
            </span>
          </ToolbarGroup>
        </Toolbar>

        <Table className="hidden rounded-none border-0 shadow-none md:block">
          <THead>
            <tr>
              {['Customer', 'Phone', 'Orders', 'Joined'].map((col) => (
                <Th key={col}>{col}</Th>
              ))}
            </tr>
          </THead>
          <TBody>
            {rows.length === 0 && (
              <tr>
                <Td colSpan={4} className="p-0">
                  <EmptyState
                    icon={UserGroupIcon}
                    title="No customers found"
                    description={
                      q
                        ? 'Try a different search term or clear the filter.'
                        : 'Customers will appear here after they register or place an order.'
                    }
                    action={
                      !q && (
                        <button
                          type="button"
                          onClick={() => setShowCreate(true)}
                          className="bg-accent text-accent-fg hover:bg-accent-hover inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold shadow-sm transition"
                        >
                          <PlusIcon className="h-4 w-4" />
                          New customer
                        </button>
                      )
                    }
                    className="border-0 shadow-none"
                  />
                </Td>
              </tr>
            )}
            {rows.map((row) => (
              <Tr
                key={row.id}
                role="link"
                tabIndex={0}
                className="group cursor-pointer"
                onClick={() => navigate(`/admin/customers/${row.id}`)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    navigate(`/admin/customers/${row.id}`);
                  }
                }}
              >
                <Td className="whitespace-normal">
                  <span className="block min-w-0">
                    <span className="text-text group-hover:text-accent block truncate font-medium transition-colors">
                      {row.name || row.email}
                    </span>
                    {row.name && (
                      <span className="text-text-muted mt-0.5 block truncate text-xs">
                        {row.email}
                      </span>
                    )}
                  </span>
                </Td>
                <Td className="text-text">{row.phone ?? '—'}</Td>
                <Td className="tabular-nums">{row.orderCount}</Td>
                <Td className="tabular-nums">{formatDate(row.createdAt)}</Td>
              </Tr>
            ))}
          </TBody>
        </Table>

        <div className="divide-border divide-y md:hidden">
          {rows.length === 0 ? (
            <EmptyState
              icon={UserGroupIcon}
              title="No customers found"
              description={
                q
                  ? 'Try a different search term.'
                  : 'Customers will appear here after they register or place an order.'
              }
              className="border-0 shadow-none"
            />
          ) : (
            rows.map((row) => (
              <Link
                key={row.id}
                to={`/admin/customers/${row.id}`}
                className="hover:bg-surface-2/60 block px-4 py-4 transition-colors"
              >
                <p className="text-text truncate text-sm font-medium">
                  {row.name || row.email}
                </p>
                {row.name && (
                  <p className="text-text-muted mt-0.5 truncate text-xs">
                    {row.email}
                  </p>
                )}
                <div className="text-text-muted mt-3 flex items-center justify-between text-xs">
                  <span>
                    {row.orderCount} order{row.orderCount !== 1 ? 's' : ''}
                  </span>
                  <span>{formatDate(row.createdAt)}</span>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>

      <Pagination page={page} totalPages={totalPages} onPageChange={goToPage} />
    </div>
  );
}
