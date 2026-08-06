import {
  redirect,
  useActionData,
  useLoaderData,
  useNavigation,
} from 'react-router';

import {
  getChannel,
  parseUpdateChannelInput,
  updateChannel,
} from '#/core/channels/index.server';
import ChannelEditor from '#/components/admin/channel-editor';

export async function loader({ params }) {
  try {
    const channel = await getChannel(params.id);
    return { channel };
  } catch (err) {
    if (err.code === 'CHANNEL_NOT_FOUND') {
      throw new Response('Channel not found', { status: 404 });
    }
    throw err;
  }
}

export async function action({ request, params }) {
  const formData = await request.formData();

  try {
    const input = await parseUpdateChannelInput({
      name: formData.get('name')?.toString(),
      handle: formData.get('handle')?.toString(),
      domain: formData.get('domain')?.toString(),
      currency: formData.get('currency')?.toString(),
      locale: formData.get('locale')?.toString(),
      active: formData.get('active'),
    });
    await updateChannel(params.id, input);
    return redirect('/admin/channels');
  } catch (err) {
    return { error: err.message ?? 'Could not save channel.' };
  }
}

export function meta({ loaderData }) {
  const name = loaderData?.channel?.name ?? 'Edit channel';
  return [{ title: `${name} — Channels` }];
}

export default function AdminEditChannelRoute() {
  const { channel } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSaving = navigation.state === 'submitting';

  return (
    <ChannelEditor
      mode="edit"
      channel={channel}
      actionData={actionData}
      isSaving={isSaving}
    />
  );
}
