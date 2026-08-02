import {
  Form,
  Link,
  redirect,
  useActionData,
  useNavigation,
} from 'react-router';

import {
  createChannel,
  parseCreateChannelInput,
} from '#/core/channels/index.server';
import { useT } from '#/core/i18n';
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
    const input = await parseCreateChannelInput({
      name: formData.get('name')?.toString(),
      handle: formData.get('handle')?.toString(),
      domain: formData.get('domain')?.toString(),
      currency: formData.get('currency')?.toString(),
      locale: formData.get('locale')?.toString(),
    });
    await createChannel(input);
    return redirect('/admin/channels');
  } catch (err) {
    return { error: err.message };
  }
}

export default function AdminNewChannelRoute() {
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
                label: t('admin.channels.new.breadcrumb'),
                href: '/admin/channels',
              },
              { label: t('admin.channels.new.title') },
            ]}
          />
        }
        title={t('admin.channels.new.title')}
        subtitle={t('admin.channels.new.subtitle')}
      />

      <ErrorAlert message={actionData?.error} />

      <Form method="post" className="space-y-6">
        <Card>
          <CardHeader
            title={t('admin.channels.new.cardTitle')}
            description={t('admin.channels.new.cardDescription')}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('admin.channels.new.name')} htmlFor="channel-name">
              <Input
                id="channel-name"
                name="name"
                required
                placeholder={t('admin.channels.new.namePlaceholder')}
              />
            </Field>
            <Field
              label={t('admin.channels.new.handle')}
              htmlFor="channel-handle"
            >
              <Input
                id="channel-handle"
                name="handle"
                required
                placeholder={t('admin.channels.new.handlePlaceholder')}
              />
            </Field>
            <Field
              label={t('admin.channels.new.domain')}
              htmlFor="channel-domain"
            >
              <Input
                id="channel-domain"
                name="domain"
                placeholder={t('admin.channels.new.domainPlaceholder')}
              />
            </Field>
            <Field
              label={t('admin.channels.new.currency')}
              htmlFor="channel-currency"
            >
              <Input
                id="channel-currency"
                name="currency"
                defaultValue="USD"
                maxLength={3}
                className="uppercase"
              />
            </Field>
            <Field
              label={t('admin.channels.new.locale')}
              htmlFor="channel-locale"
            >
              <Input id="channel-locale" name="locale" defaultValue="en" />
            </Field>
          </div>
        </Card>

        <ActionBar>
          <span />
          <div className="flex items-center gap-3">
            <Link
              to="/admin/channels"
              className="text-text-muted hover:text-text text-sm transition-colors"
            >
              {t('common.cancel')}
            </Link>
            <ButtonSubmit disabled={isSaving}>
              {isSaving
                ? t('admin.channels.new.creating')
                : t('admin.channels.new.createButton')}
            </ButtonSubmit>
          </div>
        </ActionBar>
      </Form>
    </div>
  );
}
