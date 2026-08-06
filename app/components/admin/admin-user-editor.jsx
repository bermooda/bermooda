import { Form, Link } from 'react-router';

import { useT } from '#/core/i18n';
import Breadcrumbs from '#/components/admin/breadcrumbs';
import FormSection from '#/components/admin/form-section';
import Field from '#/components/admin/form/field';
import Input from '#/components/admin/form/input';
import PageHeader from '#/components/admin/page-header';
import { ErrorAlert, SuccessAlert } from '#/components/ui/alert';
import { ButtonSubmit } from '#/components/ui/button';

/**
 * Admin staff user invite editor (FormSection detail pattern).
 *
 * @param {Object} props
 * @param {{ error?: string, ok?: boolean }} [props.actionData]
 * @param {boolean} props.isSaving
 * @returns {React.ReactElement}
 */
export default function AdminUserEditor({ actionData, isSaving }) {
  const t = useT();
  const created = Boolean(actionData?.ok);

  return (
    <div className="mx-auto max-w-5xl">
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

      {created ? (
        <SuccessAlert message={t('admin.settings.usersNew.success')} />
      ) : null}

      <ErrorAlert message={actionData?.error} />

      <Form method="post" id="admin-user-editor-form">
        <div className="space-y-12">
          <FormSection
            title={t('admin.settings.usersNew.cardTitle')}
            description={t('admin.settings.usersNew.cardDescription')}
            last
          >
            <div className="grid max-w-2xl grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
              <Field
                className="sm:col-span-3"
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
                className="sm:col-span-3"
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
          </FormSection>
        </div>
      </Form>

      <div className="mt-6 mb-6 flex items-center justify-between gap-x-6">
        <span />
        <div className="flex items-center gap-x-6">
          <Link
            to="/admin/settings"
            className="text-text text-sm/6 font-semibold transition-colors hover:opacity-80"
          >
            {created ? t('admin.settings.usersNew.back') : t('common.cancel')}
          </Link>
          {!created ? (
            <ButtonSubmit form="admin-user-editor-form" disabled={isSaving}>
              {isSaving
                ? t('admin.settings.usersNew.sending')
                : t('admin.settings.usersNew.sendButton')}
            </ButtonSubmit>
          ) : null}
        </div>
      </div>
    </div>
  );
}
