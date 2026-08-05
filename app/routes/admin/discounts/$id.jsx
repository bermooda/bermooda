import {
  redirect,
  useActionData,
  useLoaderData,
  useNavigation,
} from 'react-router';

import { handleAdminActionError } from '#/libs/api/admin-ui/index.server';
import {
  deleteDiscount,
  getDiscount,
  parseDiscountFormData,
  updateDiscount,
} from '#/core/discounts/index.server';
import DiscountEditor from '#/components/admin/discount-editor';

export async function loader({ params }) {
  const discount = await getDiscount(params.id);
  if (!discount) {
    throw new Response('Discount not found', { status: 404 });
  }
  return { discount };
}

export async function action({ request, params }) {
  const formData = await request.formData();
  const intent = formData.get('intent')?.toString();

  if (intent === 'delete') {
    try {
      await deleteDiscount(params.id);
    } catch (err) {
      return handleAdminActionError(err, {
        source: 'admin.discounts.edit.delete',
        shape: 'error',
        userMessage: 'Could not delete discount.',
      });
    }
    return redirect('/admin/discounts');
  }

  const active = formData.get('active') === 'true';
  const parsed = parseDiscountFormData(formData, { active });
  if (parsed.error) {
    return { error: parsed.error };
  }

  try {
    await updateDiscount(params.id, parsed.data);
  } catch (err) {
    return handleAdminActionError(err, {
      source: 'admin.discounts.edit',
      shape: 'error',
      knownCodes: {
        P2002: { error: 'A discount with that code already exists.' },
      },
      userMessage: 'Could not save discount.',
    });
  }

  return { ok: true };
}

export function meta({ loaderData }) {
  const code = loaderData?.discount?.code ?? 'Edit discount';
  return [{ title: `${code} — Discounts` }];
}

export default function AdminEditDiscountRoute() {
  const { discount } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSaving = navigation.state === 'submitting';

  return (
    <DiscountEditor
      mode="edit"
      discount={discount}
      actionData={actionData}
      isSaving={isSaving}
    />
  );
}
