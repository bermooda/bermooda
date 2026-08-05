import { redirect, useActionData, useNavigation } from 'react-router';

import { handleAdminActionError } from '#/libs/api/admin-ui/index.server';
import {
  createDiscount,
  parseDiscountFormData,
} from '#/core/discounts/index.server';
import DiscountEditor from '#/components/admin/discount-editor';

export async function action({ request }) {
  const formData = await request.formData();
  const parsed = parseDiscountFormData(formData, { active: true });
  if (parsed.error) {
    return { error: parsed.error };
  }

  try {
    const discount = await createDiscount(parsed.data);
    return redirect(`/admin/discounts/${discount.id}`);
  } catch (err) {
    return handleAdminActionError(err, {
      source: 'admin.discounts.new',
      shape: 'error',
      knownCodes: {
        P2002: { error: 'A discount with that code already exists.' },
      },
      userMessage: 'Could not create discount.',
    });
  }
}

export function meta() {
  return [{ title: 'New discount' }];
}

export default function AdminNewDiscountRoute() {
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSaving = navigation.state === 'submitting';

  return (
    <DiscountEditor mode="create" actionData={actionData} isSaving={isSaving} />
  );
}
