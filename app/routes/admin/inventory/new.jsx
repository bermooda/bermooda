import { redirect, useActionData, useNavigation } from 'react-router';

import { createLocation } from '#/core/inventory/index.server';
import InventoryLocationEditor from '#/components/admin/inventory-location-editor';

export async function action({ request }) {
  const formData = await request.formData();
  const name = formData.get('name')?.toString().trim();
  const code = formData.get('code')?.toString().trim().toLowerCase();

  if (!name || !code) {
    return { error: 'Name and code are required.' };
  }

  const allowsPickup =
    formData.get('allowsPickup') === 'on' ||
    formData.get('allowsPickup') === 'true';

  await createLocation({ name, code, allowsPickup });

  return redirect('/admin/inventory');
}

export default function AdminNewInventoryLocationRoute() {
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSaving = navigation.state === 'submitting';

  return (
    <InventoryLocationEditor actionData={actionData} isSaving={isSaving} />
  );
}
