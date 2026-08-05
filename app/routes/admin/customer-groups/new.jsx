import { redirect, useActionData, useNavigation } from 'react-router';

import { createCustomerGroup } from '#/core/pricing/index.server';
import CustomerGroupEditor from '#/components/admin/customer-group-editor';

export async function action({ request }) {
  const formData = await request.formData();
  const name = formData.get('name')?.toString().trim();
  const handle = formData.get('handle')?.toString().trim().toLowerCase();

  if (!name || !handle) {
    return { error: 'Name and handle are required.' };
  }

  await createCustomerGroup({ name, handle });
  return redirect('/admin/customer-groups');
}

export function meta() {
  return [{ title: 'New customer group' }];
}

export default function AdminNewCustomerGroupRoute() {
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSaving = navigation.state === 'submitting';

  return <CustomerGroupEditor actionData={actionData} isSaving={isSaving} />;
}
