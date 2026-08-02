import { Form, Link, useActionData, useNavigation } from 'react-router';

import { authenticate } from '#/libs/auth/admin/index.server';
import { useT } from '#/core/i18n';
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
    await createAdminStaffUser({
      email: formData.get('email'),
      name: formData.get('name'),
    });
    return { ok: true };
  } catch (err) {
    if (err.code === 'FORBIDDEN') {
      return { error: 'Forbidden' };
    }
    return { error: err.message };
  }
}

/**
 * @returns {React.ReactElement}
 */
export default function AdminNewAdminUserRoute() {
  const t = useT();
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
              {
                label: t('admin.settings.usersNew.breadcrumbSettings'),
                href: '/admin/settings',
              },
              { label: t('admin.settings.usersNew.breadcrumb') },
            ]}
          />
        }
        title={t('admin.settings.usersNew.title')}
        subtitle={t('admin.settings.usersNew.subtitle')}
      />

      {created && (
        <div className="bg-success/10 border-success/30 mb-6 rounded-md border p-4">
          <p className="text-success text-sm">
            {t('admin.settings.usersNew.success')}
          </p>
        </div>
      )}

      <ErrorAlert message={actionData?.error} />

      <Form method="post" className="space-y-6">
        <Card>
          <CardHeader
            title={t('admin.settings.usersNew.cardTitle')}
            description={t('admin.settings.usersNew.cardDescription')}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t('admin.settings.usersNew.email')}
              htmlFor="admin-email"
            >
              <Input
                id="admin-email"
                name="email"
                type="email"
                required
                placeholder={t('admin.settings.usersNew.emailPlaceholder')}
                disabled={created}
              />
            </Field>
            <Field
              label={t('admin.settings.usersNew.name')}
              htmlFor="admin-name"
            >
              <Input
                id="admin-name"
                name="name"
                placeholder={t('admin.settings.usersNew.namePlaceholder')}
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
              {created ? t('admin.settings.usersNew.back') : t('common.cancel')}
            </Link>
            {!created && (
              <ButtonSubmit disabled={isSaving}>
                {isSaving
                  ? t('admin.settings.usersNew.sending')
                  : t('admin.settings.usersNew.sendButton')}
              </ButtonSubmit>
            )}
          </div>
        </ActionBar>
      </Form>
    </div>
  );
}
