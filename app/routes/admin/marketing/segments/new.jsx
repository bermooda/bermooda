import {
  redirect,
  useActionData,
  useLoaderData,
  useNavigation,
} from 'react-router';

import {
  createSegment,
  parseCreateSegmentInput,
  parseSegmentRulesFromForm,
} from '#/core/marketing/index.server';
import { listCustomerGroups } from '#/core/pricing/index.server';
import MarketingSegmentEditor from '#/components/admin/marketing-segment-editor';

export async function loader() {
  const groups = await listCustomerGroups();
  return { groups };
}

export async function action({ request }) {
  const formData = await request.formData();
  try {
    await createSegment(
      parseCreateSegmentInput({
        name: formData.get('name'),
        rules: parseSegmentRulesFromForm(formData),
      })
    );
    return redirect('/admin/marketing');
  } catch (err) {
    if (err.code === 'NAME_REQUIRED') {
      return { error: err.message };
    }
    throw err;
  }
}

export default function AdminNewMarketingSegmentRoute() {
  const { groups } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSaving = navigation.state === 'submitting';

  return (
    <MarketingSegmentEditor
      groups={groups}
      actionData={actionData}
      isSaving={isSaving}
    />
  );
}
