import {
  redirect,
  useActionData,
  useLoaderData,
  useNavigation,
} from 'react-router';

import {
  createPriceList,
  listCustomerGroups,
} from '#/core/pricing/index.server';
import PriceListEditor from '#/components/admin/price-list-editor';

export async function loader() {
  const groups = await listCustomerGroups();
  return { groups };
}

export async function action({ request }) {
  const formData = await request.formData();
  const name = formData.get('name')?.toString().trim();
  const currency = formData.get('currency')?.toString().trim().toUpperCase();
  const customerGroupId = formData.get('customerGroupId')?.toString() || null;
  const priority = parseInt(formData.get('priority')?.toString() ?? '0', 10);

  if (!name || !currency) {
    return { error: 'Name and currency are required.' };
  }

  await createPriceList({
    name,
    currency,
    customerGroupId: customerGroupId || null,
    priority,
    active: true,
  });

  return redirect('/admin/price-lists');
}

export default function AdminNewPriceListRoute() {
  const { groups } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSaving = navigation.state === 'submitting';

  return (
    <PriceListEditor
      groups={groups}
      actionData={actionData}
      isSaving={isSaving}
    />
  );
}
