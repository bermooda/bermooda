import {
  Form,
  Link,
  redirect,
  useActionData,
  useLoaderData,
  useNavigation,
} from 'react-router';

import {
  getChannel,
  parseUpdateChannelInput,
  updateChannel,
} from '#/core/channels/index.server';
import { useT } from '#/core/i18n';
import ActionBar from '#/components/admin/action-bar';
import Badge from '#/components/admin/badge';
import Breadcrumbs from '#/components/admin/breadcrumbs';
import Card, { CardHeader } from '#/components/admin/card';
import Field from '#/components/admin/form/field';
import Input from '#/components/admin/form/input';
import PageHeader from '#/components/admin/page-header';
import { ErrorAlert } from '#/components/ui/alert';
import Button, { ButtonSubmit } from '#/components/ui/button';

export async function loader({ params }) {
  try {
    const channel = await getChannel(params.id);
    return { channel };
  } catch (err) {
    if (err.code === 'CHANNEL_NOT_FOUND') {
      throw new Response('Channel not found', { status: 404 });
    }
    throw err;
  }
}

export async function action({ request, params }) {
  const formData = await request.formData();

  try {
    const input = await parseUpdateChannelInput({
      name: formData.get('name')?.toString(),
      handle: formData.get('handle')?.toString(),
      domain: formData.get('domain')?.toString(),
      currency: formData.get('currency')?.toString(),
      locale: formData.get('locale')?.toString(),
      active: formData.get('active'),
    });
    await updateChannel(params.id, input);
    return redirect('/admin/channels');
  } catch (err) {
    return { error: err.message ?? 'Could not save channel.' };
  }
}

export function meta({ loaderData }) {
  const name = loaderData?.channel?.name ?? 'Edit channel';
  return [{ title: `${name} — Channels` }];
}

export default function AdminEditChannelRoute() {
  const t = useT();
  const { channel } = useLoaderData();
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
                label: t('admin.channels.edit.breadcrumb'),
                href: '/admin/channels',
              },
              { label: channel.name },
            ]}
          />
        }
        title={channel.name}
        subtitle={t('admin.channels.edit.subtitle')}
        actions={
          <div className="flex items-center gap-2">
            {channel.isDefault && (
              <Badge tone="success">
                {t('admin.channels.edit.defaultBadge')}
              </Badge>
            )}
            <Button as={Link} to="/admin/channels" variant="secondary">
              {t('admin.channels.edit.back')}
            </Button>
          </div>
        }
      />

      <ErrorAlert message={actionData?.error} />

      <Form method="post" className="space-y-6">
        <Card>
          <CardHeader
            title={t('admin.channels.edit.cardTitle')}
            description={t('admin.channels.edit.cardDescription')}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('admin.channels.edit.name')} htmlFor="channel-name">
              <Input
                id="channel-name"
                name="name"
                required
                defaultValue={channel.name}
              />
            </Field>
            <Field
              label={t('admin.channels.edit.handle')}
              htmlFor="channel-handle"
            >
              <Input
                id="channel-handle"
                name="handle"
                required
                defaultValue={channel.handle}
              />
            </Field>
            <Field
              label={t('admin.channels.edit.domain')}
              htmlFor="channel-domain"
            >
              <Input
                id="channel-domain"
                name="domain"
                defaultValue={channel.domain ?? ''}
                placeholder={t('admin.channels.edit.domainPlaceholder')}
              />
            </Field>
            <Field
              label={t('admin.channels.edit.currency')}
              htmlFor="channel-currency"
            >
              <Input
                id="channel-currency"
                name="currency"
                defaultValue={channel.currency}
                maxLength={3}
                className="uppercase"
              />
            </Field>
            <Field
              label={t('admin.channels.edit.locale')}
              htmlFor="channel-locale"
            >
              <Input
                id="channel-locale"
                name="locale"
                defaultValue={channel.locale}
              />
            </Field>
            <label className="flex items-center gap-2 self-end text-sm">
              <input
                type="checkbox"
                name="active"
                defaultChecked={Boolean(channel.active)}
              />
              {t('admin.channels.edit.active')}
            </label>
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
                ? t('admin.channels.edit.saving')
                : t('admin.channels.edit.saveButton')}
            </ButtonSubmit>
          </div>
        </ActionBar>
      </Form>
    </div>
  );
}
