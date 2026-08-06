import {
  redirect,
  useActionData,
  useLoaderData,
  useNavigation,
} from 'react-router';

import { listRecentVariantsForInventory } from '#/core/inventory/index.server';
import {
  createSubscriptionPlan,
  parseCreatePlanFromForm,
} from '#/core/subscriptions/index.server';
import SubscriptionPlanEditor from '#/components/admin/subscription-plan-editor';

export async function loader() {
  const variants = await listRecentVariantsForInventory({ take: 50 });
  return { variants };
}

export async function action({ request }) {
  const formData = await request.formData();

  try {
    const plan = await createSubscriptionPlan(
      parseCreatePlanFromForm(formData)
    );
    return redirect(`/admin/subscriptions/${plan.id}`);
  } catch (err) {
    return { error: err.message ?? 'Could not create plan.' };
  }
}

export function meta() {
  return [{ title: 'New plan — Subscriptions' }];
}

export default function AdminNewSubscriptionPlanRoute() {
  const { variants } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSaving = navigation.state === 'submitting';

  return (
    <SubscriptionPlanEditor
      mode="create"
      variants={variants}
      actionData={actionData}
      isSaving={isSaving}
    />
  );
}
