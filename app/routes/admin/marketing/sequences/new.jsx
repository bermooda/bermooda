import { redirect, useActionData, useNavigation } from 'react-router';

import {
  createAbandonedCartSequence,
  parseCreateAbandonedCartSequenceInput,
} from '#/core/marketing/index.server';
import MarketingSequenceEditor from '#/components/admin/marketing-sequence-editor';

export async function action({ request }) {
  const formData = await request.formData();

  try {
    await createAbandonedCartSequence(
      parseCreateAbandonedCartSequenceInput({
        name: formData.get('name'),
        stepNumber: formData.get('stepNumber'),
        delayMinutes: formData.get('delayMinutes'),
        subject: formData.get('subject'),
      })
    );
    return redirect('/admin/marketing');
  } catch (err) {
    if (err.code === 'SEQUENCE_INVALID') {
      return { error: err.message };
    }
    throw err;
  }
}

export default function AdminNewMarketingSequenceRoute() {
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSaving = navigation.state === 'submitting';

  return (
    <MarketingSequenceEditor actionData={actionData} isSaving={isSaving} />
  );
}
