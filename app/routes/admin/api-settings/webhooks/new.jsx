import {
  redirect,
  useActionData,
  useLoaderData,
  useNavigation,
} from 'react-router';

import { authenticate } from '#/libs/auth/admin/index.server';
import { DOMAIN_EVENTS } from '#/core/events/names';
import { createSubscription } from '#/core/webhooks/index.server';
import WebhookEditor from '#/components/admin/webhook-editor';

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
  const { supportedEvents } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSaving = navigation.state === 'submitting';

  return (
    <WebhookEditor
      supportedEvents={supportedEvents}
      actionData={actionData}
      isSaving={isSaving}
    />
  );
}
