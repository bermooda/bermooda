import bcrypt from 'bcryptjs';
import { Form, Link, useActionData, useNavigation } from 'react-router';

import { authenticate } from '#/libs/auth/admin.server';
import prisma from '#/libs/prisma.server';
import { hasPermission } from '#/core/rbac/index.server';
import ActionBar from '#/components/admin/action-bar';
import Breadcrumbs from '#/components/admin/breadcrumbs';
import Card, { CardHeader } from '#/components/admin/card';
import Field from '#/components/admin/form/field';
import Input from '#/components/admin/form/input';
import PageHeader from '#/components/admin/page-header';
import { ErrorAlert } from '#/components/ui/alert';
import { ButtonSubmit } from '#/components/ui/button';

export async function action({ request }) {
  const session = await authenticate(request);
  if (!(await hasPermission(session.user.role, 'settings:manage'))) {
    return { error: 'Forbidden' };
  }

  const formData = await request.formData();
  const email = formData.get('email')?.toString().trim() ?? '';
  const name = formData.get('name')?.toString().trim() ?? '';

  if (!email) return { error: 'Email is required.' };

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: 'A user with that email already exists.' };
  }

  const hashedPassword = await bcrypt.hash('ChangeMe123!', 10);
  const user = await prisma.user.create({
    data: {
      email,
      name: name || email,
      role: 'staff',
      emailVerified: false,
    },
  });
  await prisma.account.create({
    data: {
      accountId: user.id,
      providerId: 'credential',
      userId: user.id,
      password: hashedPassword,
    },
  });

  return { ok: true };
}

export default function AdminNewAdminUserRoute() {
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSaving = navigation.state === 'submitting';
  const created = actionData?.ok;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Settings', href: '/admin/settings' },
              { label: 'Invite admin' },
            ]}
          />
        }
        title="Invite admin user"
        subtitle="Create a new staff account for the admin back office."
      />

      {created && (
        <div className="bg-success/10 border-success/30 mb-6 rounded-md border p-4">
          <p className="text-success text-sm">
            User created. Temporary password:{' '}
            <code className="font-mono font-bold">ChangeMe123!</code> — ask them
            to change it on first login.
          </p>
        </div>
      )}

      <ErrorAlert message={actionData?.error} />

      <Form method="post" className="space-y-6">
        <Card>
          <CardHeader
            title="User details"
            description="A temporary password will be assigned automatically."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Email *" htmlFor="admin-email">
              <Input
                id="admin-email"
                name="email"
                type="email"
                required
                placeholder="admin@example.com"
                disabled={created}
              />
            </Field>
            <Field label="Name (optional)" htmlFor="admin-name">
              <Input
                id="admin-name"
                name="name"
                placeholder="Jane Smith"
                disabled={created}
              />
            </Field>
          </div>
        </Card>

        <ActionBar>
          <span />
          <div className="flex items-center gap-3">
            <Link
              to="/admin/settings"
              className="text-text-muted hover:text-text text-sm transition-colors"
            >
              {created ? 'Back to settings' : 'Cancel'}
            </Link>
            {!created && (
              <ButtonSubmit disabled={isSaving}>
                {isSaving ? 'Creating…' : 'Create user'}
              </ButtonSubmit>
            )}
          </div>
        </ActionBar>
      </Form>
    </div>
  );
}
