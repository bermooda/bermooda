import { Form, Link, useActionData, useNavigation } from 'react-router';

import { authenticate } from '#/libs/auth/admin/index.server';
import {
  createAdminStaffUser,
  requirePermission,
  SETTINGS_MANAGE_PERMISSION,
} from '#/core/rbac/index.server';
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

  try {
    await requirePermission(session.user, SETTINGS_MANAGE_PERMISSION);
    const formData = await request.formData();
    const { temporaryPassword } = await createAdminStaffUser({
      email: formData.get('email'),
      name: formData.get('name'),
    });
    return { ok: true, temporaryPassword };
  } catch (err) {
    if (err.code === 'FORBIDDEN') {
      return { error: 'Forbidden' };
    }
    return { error: err.message };
  }
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
            <code className="font-mono font-bold">
              {actionData.temporaryPassword}
            </code>{' '}
            — ask them to change it on first login.
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
