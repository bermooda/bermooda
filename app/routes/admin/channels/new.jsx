import {
  Form,
  Link,
  redirect,
  useActionData,
  useNavigation,
} from 'react-router';

import ActionBar from '#/components/admin/action-bar';
import Breadcrumbs from '#/components/admin/breadcrumbs';
import Card, { CardHeader } from '#/components/admin/card';
import Field from '#/components/admin/form/field';
import Input from '#/components/admin/form/input';
import PageHeader from '#/components/admin/page-header';
import { ErrorAlert } from '#/components/ui/alert';
import { ButtonSubmit } from '#/components/ui/button';

import { createChannel } from '#/core/channels/index.server';

export async function action({ request }) {
  const formData = await request.formData();
  const name = formData.get('name')?.toString().trim();
  const handle = formData.get('handle')?.toString().trim().toLowerCase();
  const domain = formData.get('domain')?.toString().trim() || null;
  const currency = formData.get('currency')?.toString().trim() || 'USD';
  const locale = formData.get('locale')?.toString().trim() || 'en';

  if (!name || !handle) {
    return { error: 'Name and handle are required.' };
  }

  await createChannel({ name, handle, domain, currency, locale });
  return redirect('/admin/channels');
}

export default function AdminNewChannelRoute() {
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSaving = navigation.state === 'submitting';

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Channels', href: '/admin/channels' },
              { label: 'New channel' },
            ]}
          />
        }
        title="New sales channel"
        subtitle="Add a multi-storefront channel with domain routing."
      />

      <ErrorAlert message={actionData?.error} />

      <Form method="post" className="space-y-6">
        <Card>
          <CardHeader
            title="Channel details"
            description="Configure name, handle, and optional custom domain."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name *" htmlFor="channel-name">
              <Input
                id="channel-name"
                name="name"
                required
                placeholder="EU Store"
              />
            </Field>
            <Field label="Handle *" htmlFor="channel-handle">
              <Input
                id="channel-handle"
                name="handle"
                required
                placeholder="eu-store"
              />
            </Field>
            <Field label="Domain (optional)" htmlFor="channel-domain">
              <Input
                id="channel-domain"
                name="domain"
                placeholder="shop.example.eu"
              />
            </Field>
            <Field label="Currency" htmlFor="channel-currency">
              <Input
                id="channel-currency"
                name="currency"
                defaultValue="USD"
                maxLength={3}
                className="uppercase"
              />
            </Field>
            <Field label="Locale" htmlFor="channel-locale">
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
              Cancel
            </Link>
            <ButtonSubmit disabled={isSaving}>
              {isSaving ? 'Creating…' : 'Create channel'}
            </ButtonSubmit>
          </div>
        </ActionBar>
      </Form>
    </div>
  );
}
