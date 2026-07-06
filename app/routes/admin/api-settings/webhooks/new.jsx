import { useState } from 'react';
import {
  Form,
  Link,
  redirect,
  useActionData,
  useLoaderData,
  useNavigation,
} from 'react-router';

import { authenticate } from '#/libs/auth/admin.server';
import {
  createSubscription,
  WEBHOOK_EVENTS,
} from '#/core/webhooks/index.server';
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
  return { supportedEvents: WEBHOOK_EVENTS };
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

export default function AdminNewWebhookRoute() {
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
              { label: 'API', href: '/admin/api-settings' },
              { label: 'New webhook' },
            ]}
          />
        }
        title="New webhook endpoint"
        subtitle="Receive real-time domain events as signed HTTP POSTs."
      />

      <ErrorAlert message={actionData?.error} />

      <Form method="post" className="space-y-6">
        {selectedEvents.map((e) => (
          <input key={e} type="hidden" name="events" value={e} />
        ))}

        <Card>
          <CardHeader
            title="Endpoint details"
            description="Deliveries are retried on failure with exponential back-off."
          />
          <div className="space-y-4">
            <Field label="URL *" htmlFor="webhook-url">
              <Input
                id="webhook-url"
                name="url"
                type="url"
                required
                placeholder="https://example.com/webhook"
              />
            </Field>
            <Field label="Signing secret *" htmlFor="webhook-secret">
              <Input
                id="webhook-secret"
                name="secret"
                required
                placeholder="whsec_..."
              />
              <p className="text-text-muted mt-1 text-xs">
                Used to compute HMAC-SHA256 signatures in the{' '}
                <code>X-Bermooda-Signature</code> header.
              </p>
            </Field>
            <Field label="Label (optional)" htmlFor="webhook-label">
              <Input
                id="webhook-label"
                name="label"
                placeholder="Production webhook"
              />
            </Field>
            <Field label="Events *">
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
              Cancel
            </Link>
            <ButtonSubmit disabled={isSaving}>
              {isSaving ? 'Creating…' : 'Create webhook'}
            </ButtonSubmit>
          </div>
        </ActionBar>
      </Form>
    </div>
  );
}
