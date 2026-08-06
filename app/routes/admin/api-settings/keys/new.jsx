import { useActionData, useNavigation } from 'react-router';

import { authenticate } from '#/libs/auth/admin/index.server';
import {
  createApiKey,
  parseCreateApiKeyFormData,
} from '#/core/api-keys/index.server';
import ApiKeyEditor from '#/components/admin/api-key-editor';

export async function action({ request }) {
  await authenticate(request);
  const formData = await request.formData();

  try {
    const input = parseCreateApiKeyFormData(formData);
    const { key, record } = await createApiKey(input);
    return { ok: true, key, record };
  } catch (err) {
    return { error: err.message };
  }
}

/**
 * @returns {React.ReactElement}
 */
export default function AdminNewApiKeyRoute() {
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSaving = navigation.state === 'submitting';

  return <ApiKeyEditor actionData={actionData} isSaving={isSaving} />;
}
