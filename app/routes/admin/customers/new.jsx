import { redirect, useActionData, useNavigation } from 'react-router';

import { createCustomer } from '#/core/customers/index.server';
import CustomerEditor from '#/components/admin/customer-editor';

export async function action({ request }) {
  const formData = await request.formData();
  const email = formData.get('email')?.toString().trim() ?? '';
  const name = formData.get('name')?.toString().trim() || null;
  const phone = formData.get('phone')?.toString().trim() || null;

  if (!email) {
    return { error: 'Email is required.' };
  }

  try {
    const customer = await createCustomer({ email, name, phone });
    return redirect(`/admin/customers/${customer.id}`);
  } catch (err) {
    if (err.code === 'CUSTOMER_EMAIL_EXISTS') {
      return { error: err.message };
    }
    throw err;
  }
}

export function meta() {
  return [{ title: 'New customer' }];
}

export default function AdminNewCustomerRoute() {
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSaving = navigation.state === 'submitting';

  return <CustomerEditor actionData={actionData} isSaving={isSaving} />;
}
