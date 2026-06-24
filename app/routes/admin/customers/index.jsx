// app/routes/admin/customers/index.jsx
// Customers admin list — paginated table with email/name search and inline create panel.

import {
  MagnifyingGlassIcon,
  PlusIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useState } from 'react';
import {
  Form,
  Link,
  redirect,
  useActionData,
  useLoaderData,
  useSearchParams,
} from 'react-router';

import { containsFilter } from '#/utils/prisma-filters.server';
import prisma from '#/libs/prisma.server';
import Card from '#/components/admin/card';
import Field from '#/components/admin/form/field';
import Input, { controlClasses } from '#/components/admin/form/input';
import PageHeader from '#/components/admin/page-header';
import Pagination from '#/components/admin/pagination';
import Table, { TBody, Td, Th, THead } from '#/components/admin/table';
import { ErrorAlert } from '#/components/ui/alert';
import Button, { ButtonSubmit } from '#/components/ui/button';

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

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

  const [total, customers] = await Promise.all([
    prisma.customer.count({ where }),
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
      },
    }),
  ]);

  const rows = customers.map((c) => ({
    id: c.id,
    email: c.email,
    name: c.name ?? null,
    phone: c.phone ?? null,
    createdAt: c.createdAt.toISOString(),
  }));

  return {
    rows,
    total,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.ceil(total / PAGE_SIZE),
    q,
  };
}

// ---------------------------------------------------------------------------
// Action
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AdminCustomersRoute() {
  const { rows, total, page, totalPages, q } = useLoaderData();
  const actionData = useActionData();
  const [, setSearchParams] = useSearchParams();
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
        subtitle={`${total} customer${total !== 1 ? 's' : ''}`}
        actions={
          <Button variant="primary" onClick={() => setShowCreate((v) => !v)}>
            {showCreate ? (
              <>
                <XMarkIcon className="mr-1.5 h-4 w-4" />
                Cancel
              </>
            ) : (
              <>
                <PlusIcon className="mr-1.5 h-4 w-4" />
                Create Customer
              </>
            )}
          </Button>
        }
        className="mb-6"
      />

      {/* Inline Create Panel */}
      {showCreate && (
        <Card className="mb-6">
          <h2 className="text-text mb-4 text-base font-semibold">
            New Customer
          </h2>
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
              <ButtonSubmit>Create Customer</ButtonSubmit>
              <Button variant="secondary" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
            </div>
          </Form>
        </Card>
      )}

      {/* Search */}
      <Form method="get" className="mb-4">
        <div className="relative max-w-sm">
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

      {/* Table (md+) */}
      <Table className="hidden md:block">
        <THead>
          <tr>
            <Th>Email</Th>
            <Th>Name</Th>
            <Th>Phone</Th>
            <Th>Created</Th>
            <Th />
          </tr>
        </THead>
        <TBody>
          {rows.length === 0 && (
            <tr>
              <Td colSpan={5} className="py-8 text-center">
                No customers found.
              </Td>
            </tr>
          )}
          {rows.map((row) => (
            <tr key={row.id}>
              <Td className="text-text font-medium">{row.email}</Td>
              <Td className="text-text">{row.name ?? '—'}</Td>
              <Td className="text-text">{row.phone ?? '—'}</Td>
              <Td>{formatDate(row.createdAt)}</Td>
              <Td className="text-right">
                <Link
                  to={`/admin/customers/${row.id}`}
                  className="text-accent font-medium hover:underline"
                >
                  View
                </Link>
              </Td>
            </tr>
          ))}
        </TBody>
      </Table>

      {/* Card list (mobile) */}
      <div className="space-y-3 md:hidden">
        {rows.length === 0 ? (
          <Card className="text-text-muted text-center text-sm">
            No customers found.
          </Card>
        ) : (
          rows.map((row) => (
            <Link
              key={row.id}
              to={`/admin/customers/${row.id}`}
              className="block"
            >
              <Card className="space-y-1">
                <p className="text-text truncate text-sm font-medium">
                  {row.email}
                </p>
                {row.name && (
                  <p className="text-text-muted text-sm">{row.name}</p>
                )}
                <div className="text-text-muted flex items-center justify-between text-xs">
                  <span>{row.phone ?? '—'}</span>
                  <span>{formatDate(row.createdAt)}</span>
                </div>
              </Card>
            </Link>
          ))
        )}
      </div>

      <Pagination page={page} totalPages={totalPages} onPageChange={goToPage} />
    </div>
  );
}
