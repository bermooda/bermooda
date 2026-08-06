import {
  redirect,
  useActionData,
  useLoaderData,
  useNavigation,
} from 'react-router';

import {
  getSubscriptionPlan,
  parseUpdatePlanInput,
  updateSubscriptionPlan,
} from '#/core/subscriptions/index.server';
import SubscriptionPlanEditor from '#/components/admin/subscription-plan-editor';

export async function loader({ params }) {
  try {
    const plan = await getSubscriptionPlan(params.id);
    return { plan };
  } catch (err) {
    if (err.code === 'NOT_FOUND' || err.status === 404) {
      throw new Response('Plan not found', { status: 404 });
    }
    throw err;
  }
}

export async function action({ request, params }) {
  const formData = await request.formData();

  try {
    const input = parseUpdatePlanInput({
      name: formData.get('name'),
      interval: formData.get('interval'),
      intervalCount: formData.get('intervalCount'),
      active: formData.get('active') === 'on',
    });
    await updateSubscriptionPlan(params.id, input);
    return redirect('/admin/subscriptions');
  } catch (err) {
    return { error: err.message ?? 'Could not save plan.' };
  }
}

export function meta({ loaderData }) {
  const name = loaderData?.plan?.name ?? 'Edit plan';
  return [{ title: `${name} — Subscriptions` }];
}

export default function AdminEditSubscriptionPlanRoute() {
  const { plan } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSaving = navigation.state === 'submitting';

  return (
    <SubscriptionPlanEditor
      mode="edit"
      plan={plan}
      actionData={actionData}
      isSaving={isSaving}
    />
  );
}
