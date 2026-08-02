import {
  Form,
  Link,
  redirect,
  useActionData,
  useNavigation,
} from 'react-router';

import { useT } from '#/core/i18n';
import {
  createAbandonedCartSequence,
  parseCreateAbandonedCartSequenceInput,
} from '#/core/marketing/index.server';
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

  try {
    await createAbandonedCartSequence(
      parseCreateAbandonedCartSequenceInput({
        name: formData.get('name'),
        stepNumber: formData.get('stepNumber'),
        delayMinutes: formData.get('delayMinutes'),
        subject: formData.get('subject'),
      })
    );
    return redirect('/admin/marketing');
  } catch (err) {
    if (err.code === 'SEQUENCE_INVALID') {
      return { error: err.message };
    }
    throw err;
  }
}

export default function AdminNewMarketingSequenceRoute() {
  const t = useT();
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSaving = navigation.state === 'submitting';

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              {
                label: t('admin.marketing.sequencesNew.breadcrumb'),
                href: '/admin/marketing',
              },
              { label: t('admin.marketing.sequencesNew.title') },
            ]}
          />
        }
        title={t('admin.marketing.sequencesNew.title')}
        subtitle={t('admin.marketing.sequencesNew.subtitle')}
      />

      <ErrorAlert message={actionData?.error} />

      <Form method="post" className="space-y-6">
        <Card>
          <CardHeader
            title={t('admin.marketing.sequencesNew.cardTitle')}
            description={t('admin.marketing.sequencesNew.cardDescription')}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t('admin.marketing.sequencesNew.name')}
              htmlFor="sequence-name"
            >
              <Input
                id="sequence-name"
                name="name"
                required
                placeholder={t('admin.marketing.sequencesNew.namePlaceholder')}
              />
            </Field>
            <Field
              label={t('admin.marketing.sequencesNew.stepNumber')}
              htmlFor="sequence-step"
            >
              <Input
                id="sequence-step"
                name="stepNumber"
                type="number"
                min="1"
                defaultValue="1"
              />
            </Field>
            <Field
              label={t('admin.marketing.sequencesNew.delay')}
              htmlFor="sequence-delay"
            >
              <Input
                id="sequence-delay"
                name="delayMinutes"
                type="number"
                min="1"
                defaultValue="60"
              />
            </Field>
            <Field
              label={t('admin.marketing.sequencesNew.subject')}
              htmlFor="sequence-subject"
            >
              <Input
                id="sequence-subject"
                name="subject"
                required
                placeholder={t(
                  'admin.marketing.sequencesNew.subjectPlaceholder'
                )}
              />
            </Field>
          </div>
        </Card>

        <ActionBar>
          <span />
          <div className="flex items-center gap-3">
            <Link
              to="/admin/marketing"
              className="text-text-muted hover:text-text text-sm transition-colors"
            >
              {t('common.cancel')}
            </Link>
            <ButtonSubmit disabled={isSaving}>
              {isSaving
                ? t('admin.marketing.sequencesNew.creating')
                : t('admin.marketing.sequencesNew.createButton')}
            </ButtonSubmit>
          </div>
        </ActionBar>
      </Form>
    </div>
  );
}
