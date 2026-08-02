import {
  Form,
  Link,
  redirect,
  useActionData,
  useLoaderData,
  useNavigation,
} from 'react-router';

import { useT } from '#/core/i18n';
import {
  createCampaign,
  listSegments,
  parseCreateCampaignInput,
} from '#/core/marketing/index.server';
import ActionBar from '#/components/admin/action-bar';
import Breadcrumbs from '#/components/admin/breadcrumbs';
import Card, { CardHeader } from '#/components/admin/card';
import Field from '#/components/admin/form/field';
import Input from '#/components/admin/form/input';
import Select from '#/components/admin/form/select';
import Textarea from '#/components/admin/form/textarea';
import PageHeader from '#/components/admin/page-header';
import { ErrorAlert } from '#/components/ui/alert';
import { ButtonSubmit } from '#/components/ui/button';

export async function loader() {
  const { segments } = await listSegments({ limit: 100 });
  return { segments };
}

export async function action({ request }) {
  const formData = await request.formData();

  try {
    await createCampaign(
      parseCreateCampaignInput({
        segmentId: formData.get('segmentId'),
        name: formData.get('name'),
        subject: formData.get('subject'),
        bodyHtml: formData.get('bodyHtml'),
      })
    );
    return redirect('/admin/marketing');
  } catch (err) {
    if (err.code === 'CAMPAIGN_INVALID') {
      return { error: err.message };
    }
    if (err.code === 'NOT_FOUND') {
      return { error: 'Selected segment was not found.' };
    }
    throw err;
  }
}

export default function AdminNewMarketingCampaignRoute() {
  const t = useT();
  const { segments } = useLoaderData();
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
                label: t('admin.marketing.campaignsNew.breadcrumb'),
                href: '/admin/marketing',
              },
              { label: t('admin.marketing.campaignsNew.title') },
            ]}
          />
        }
        title={t('admin.marketing.campaignsNew.title')}
        subtitle={t('admin.marketing.campaignsNew.subtitle')}
      />

      <ErrorAlert message={actionData?.error} />

      <Form method="post" className="space-y-6">
        <Card>
          <CardHeader
            title={t('admin.marketing.campaignsNew.cardTitle')}
            description={t('admin.marketing.campaignsNew.cardDescription')}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t('admin.marketing.campaignsNew.segment')}
              htmlFor="campaign-segment"
            >
              <Select
                id="campaign-segment"
                name="segmentId"
                required
                defaultValue=""
              >
                <option value="" disabled>
                  {t('admin.marketing.campaignsNew.selectSegment')}
                </option>
                {segments.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label={t('admin.marketing.campaignsNew.name')}
              htmlFor="campaign-name"
            >
              <Input
                id="campaign-name"
                name="name"
                required
                placeholder={t('admin.marketing.campaignsNew.namePlaceholder')}
              />
            </Field>
            <Field
              label={t('admin.marketing.campaignsNew.subject')}
              htmlFor="campaign-subject"
              className="sm:col-span-2"
            >
              <Input
                id="campaign-subject"
                name="subject"
                required
                placeholder={t(
                  'admin.marketing.campaignsNew.subjectPlaceholder'
                )}
              />
            </Field>
            <Field
              label={t('admin.marketing.campaignsNew.body')}
              htmlFor="campaign-body"
              className="sm:col-span-2"
            >
              <Textarea
                id="campaign-body"
                name="bodyHtml"
                required
                rows={8}
                placeholder={t('admin.marketing.campaignsNew.bodyPlaceholder')}
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
                ? t('admin.marketing.campaignsNew.creating')
                : t('admin.marketing.campaignsNew.createButton')}
            </ButtonSubmit>
          </div>
        </ActionBar>
      </Form>
    </div>
  );
}
