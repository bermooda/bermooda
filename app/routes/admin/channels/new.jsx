import { redirect, useActionData, useNavigation } from 'react-router';

import {
  createChannel,
  parseCreateChannelInput,
} from '#/core/channels/index.server';
import ChannelEditor from '#/components/admin/channel-editor';

export async function action({ request }) {
  const formData = await request.formData();

  try {
    const input = await parseCreateChannelInput({
      name: formData.get('name')?.toString(),
      handle: formData.get('handle')?.toString(),
      domain: formData.get('domain')?.toString(),
      currency: formData.get('currency')?.toString(),
      locale: formData.get('locale')?.toString(),
    });
    await createChannel(input);
    return redirect('/admin/channels');
  } catch (err) {
    return { error: err.message };
  }
}

export function meta() {
  return [{ title: 'New sales channel' }];
}

export default function AdminNewChannelRoute() {
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSaving = navigation.state === 'submitting';

  return (
    <ChannelEditor mode="create" actionData={actionData} isSaving={isSaving} />
  );
}
