import {
  redirect,
  useActionData,
  useLoaderData,
  useNavigation,
} from 'react-router';

import {
  createCampaign,
  listSegments,
  parseCreateCampaignInput,
} from '#/core/marketing/index.server';
import MarketingCampaignEditor from '#/components/admin/marketing-campaign-editor';

export async function loader() {
  const { segments } = await listSegments({ limit: 100 });
  return { segments };
}

export async function action({ request }) {
  const formData = await request.formData();

  try {
    await createCampaign(
      parseCreateCampaignInput({
        segmentId: formData.get('segmentId'),
        name: formData.get('name'),
        subject: formData.get('subject'),
        bodyHtml: formData.get('bodyHtml'),
      })
    );
    return redirect('/admin/marketing');
  } catch (err) {
    if (err.code === 'CAMPAIGN_INVALID') {
      return { error: err.message };
    }
    if (err.code === 'NOT_FOUND') {
      return { error: 'Selected segment was not found.' };
    }
    throw err;
  }
}

export default function AdminNewMarketingCampaignRoute() {
  const { segments } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSaving = navigation.state === 'submitting';

  return (
    <MarketingCampaignEditor
      segments={segments}
      actionData={actionData}
      isSaving={isSaving}
    />
  );
}
