import { useState } from 'react';
import {
  Form,
  Link,
  redirect,
  useActionData,
  useLoaderData,
  useNavigation,
} from 'react-router';

import { authenticate } from '#/libs/auth/admin/index.server';
import { DOMAIN_EVENTS } from '#/core/events/names';
import { useT } from '#/core/i18n';
import { createSubscription } from '#/core/webhooks/index.server';
import ActionBar from '#/components/admin/action-bar';
import Breadcrumbs from '#/components/admin/breadcrumbs';
import Card, { CardHeader } from '#/components/admin/card';
import Field from '#/components/admin/form/field';
import Input from '#/components/admin/form/input';
import PageHeader from '#/components/admin/page-header';
import { ErrorAlert } from '#/components/ui/alert';
import { ButtonSubmit } from '#/components/ui/button';

const CHECKBOX_CLASS =
  'border-border text-accent focus:ring-accent bg-surface h-4 w-4 rounded';

export async function loader({ request }) {
  await authenticate(request);
  return { supportedEvents: DOMAIN_EVENTS };
}

export async function action({ request }) {
  await authenticate(request);
  const formData = await request.formData();
  const url = formData.get('url')?.toString();
  const secret = formData.get('secret')?.toString();
  const label = formData.get('label')?.toString();
  const events = formData.getAll('events').map(String);

  try {
    await createSubscription({ url, events, secret, label });
    return redirect('/admin/api-settings');
  } catch (err) {
    return { error: err.message };
  }
}

/**
 * @returns {React.ReactElement}
 */
export default function AdminNewWebhookRoute() {
  const t = useT();
  const { supportedEvents } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSaving = navigation.state === 'submitting';
  const [selectedEvents, setSelectedEvents] = useState([]);

  function toggleEvent(event) {
    setSelectedEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              {
                label: t('admin.apiSettings.webhooksNew.breadcrumbApi'),
                href: '/admin/api-settings',
              },
              { label: t('admin.apiSettings.webhooksNew.breadcrumb') },
            ]}
          />
        }
        title={t('admin.apiSettings.webhooksNew.title')}
        subtitle={t('admin.apiSettings.webhooksNew.subtitle')}
      />

      <ErrorAlert message={actionData?.error} />

      <Form method="post" className="space-y-6">
        {selectedEvents.map((e) => (
          <input key={e} type="hidden" name="events" value={e} />
        ))}

        <Card>
          <CardHeader
            title={t('admin.apiSettings.webhooksNew.cardTitle')}
            description={t('admin.apiSettings.webhooksNew.cardDescription')}
          />
          <div className="space-y-4">
            <Field
              label={t('admin.apiSettings.webhooksNew.url')}
              htmlFor="webhook-url"
            >
              <Input
                id="webhook-url"
                name="url"
                type="url"
                required
                placeholder={t('admin.apiSettings.webhooksNew.urlPlaceholder')}
              />
            </Field>
            <Field
              label={t('admin.apiSettings.webhooksNew.secret')}
              htmlFor="webhook-secret"
            >
              <Input
                id="webhook-secret"
                name="secret"
                required
                placeholder={t(
                  'admin.apiSettings.webhooksNew.secretPlaceholder'
                )}
              />
              <p className="text-text-muted mt-1 text-xs">
                {t('admin.apiSettings.webhooksNew.secretHelp')}
              </p>
            </Field>
            <Field
              label={t('admin.apiSettings.webhooksNew.label')}
              htmlFor="webhook-label"
            >
              <Input
                id="webhook-label"
                name="label"
                placeholder={t(
                  'admin.apiSettings.webhooksNew.labelPlaceholder'
                )}
              />
            </Field>
            <Field label={t('admin.apiSettings.webhooksNew.events')}>
              <div className="grid gap-2 sm:grid-cols-2">
                {supportedEvents.map((event) => (
                  <label
                    key={event}
                    className="text-text flex items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={selectedEvents.includes(event)}
                      onChange={() => toggleEvent(event)}
                      className={CHECKBOX_CLASS}
                    />
                    <code className="text-xs">{event}</code>
                  </label>
                ))}
              </div>
            </Field>
          </div>
        </Card>

        <ActionBar>
          <span />
          <div className="flex items-center gap-3">
            <Link
              to="/admin/api-settings"
              className="text-text-muted hover:text-text text-sm transition-colors"
            >
              {t('common.cancel')}
            </Link>
            <ButtonSubmit disabled={isSaving}>
              {isSaving
                ? t('admin.apiSettings.webhooksNew.creating')
                : t('admin.apiSettings.webhooksNew.createButton')}
            </ButtonSubmit>
          </div>
        </ActionBar>
      </Form>
    </div>
  );
}
