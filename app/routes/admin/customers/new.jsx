import {
  Form,
  Link,
  redirect,
  useActionData,
  useNavigation,
} from 'react-router';

import prisma from '#/libs/prisma.server';
import ActionBar from '#/components/admin/action-bar';
import Breadcrumbs from '#/components/admin/breadcrumbs';
import Card, { CardHeader } from '#/components/admin/card';
import Field from '#/components/admin/form/field';
import Input from '#/components/admin/form/input';
import PageHeader from '#/components/admin/page-header';
import { ErrorAlert } from '#/components/ui/alert';
import { ButtonSubmit } from '#/components/ui/button';

export async function action({ request }) {
  const formData = await request.formData();
  const email = formData.get('email')?.toString().trim() ?? '';
  const name = formData.get('name')?.toString().trim() || null;
  const phone = formData.get('phone')?.toString().trim() || null;

  if (!email) {
    return { error: 'Email is required.' };
  }

  const existing = await prisma.customer.findUnique({ where: { email } });
  if (existing) {
    return { error: 'A customer with that email already exists.' };
  }

  const customer = await prisma.customer.create({
    data: { email, name, phone },
  });

  return redirect(`/admin/customers/${customer.id}`);
}

export default function AdminNewCustomerRoute() {
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSaving = navigation.state === 'submitting';

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Customers', href: '/admin/customers' },
              { label: 'New customer' },
            ]}
          />
        }
        title="New customer"
        subtitle="Create a customer profile with contact details."
      />

      <ErrorAlert message={actionData?.error} />

      <Form method="post" className="space-y-6">
        <Card>
          <CardHeader
            title="Customer details"
            description="Email is required. Name and phone are optional."
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Email *" htmlFor="customer-email">
              <Input
                id="customer-email"
                type="email"
                name="email"
                required
                placeholder="customer@example.com"
              />
            </Field>
            <Field label="Name" htmlFor="customer-name">
              <Input
                id="customer-name"
                type="text"
                name="name"
                placeholder="Jane Doe"
              />
            </Field>
            <Field label="Phone" htmlFor="customer-phone">
              <Input
                id="customer-phone"
                type="tel"
                name="phone"
                placeholder="+1 555 000 0000"
              />
            </Field>
          </div>
        </Card>

        <ActionBar>
          <span />
          <div className="flex items-center gap-3">
            <Link
              to="/admin/customers"
              className="text-text-muted hover:text-text text-sm transition-colors"
            >
              Cancel
            </Link>
            <ButtonSubmit disabled={isSaving}>
              {isSaving ? 'Creating…' : 'Create customer'}
            </ButtonSubmit>
          </div>
        </ActionBar>
      </Form>
    </div>
  );
}
