import { redirect, useActionData, useNavigation } from 'react-router';

import {
  issueGiftCard,
  parseIssueGiftCardInput,
} from '#/core/gift-cards/index.server';
import GiftCardEditor from '#/components/admin/gift-card-editor';

export async function action({ request }) {
  const formData = await request.formData();
  const input = parseIssueGiftCardInput({
    code: formData.get('code'),
    balanceCents: formData.get('balanceCents'),
    currency: formData.get('currency'),
  });

  if (!input.balanceCents || input.balanceCents <= 0) {
    return { error: 'Balance must be greater than zero.' };
  }

  try {
    await issueGiftCard(input);
    return redirect('/admin/gift-cards');
  } catch (err) {
    if (err.code === 'GIFT_CARD_CODE_EXISTS') {
      return { error: err.message };
    }
    throw err;
  }
}

export default function AdminNewGiftCardRoute() {
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSaving = navigation.state === 'submitting';

  return <GiftCardEditor actionData={actionData} isSaving={isSaving} />;
}
