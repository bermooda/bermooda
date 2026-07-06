import {
  Form,
  Link,
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
import ActionBar from '#/components/admin/action-bar';
import Breadcrumbs from '#/components/admin/breadcrumbs';
import Card, { CardHeader } from '#/components/admin/card';
import Field from '#/components/admin/form/field';
import Input from '#/components/admin/form/input';
import Select from '#/components/admin/form/select';
import Textarea from '#/components/admin/form/textarea';
import PageHeader from '#/components/admin/page-header';
import { ErrorAlert } from '#/components/ui/alert';
import { ButtonSubmit } from '#/components/ui/button';

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
    <div className="mx-auto max-w-6xl">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Marketing', href: '/admin/marketing' },
              { label: 'New campaign' },
            ]}
          />
        }
        title="New campaign"
        subtitle="Create an email campaign for a customer segment."
      />

      <ErrorAlert message={actionData?.error} />

      <Form method="post" className="space-y-6">
        <Card>
          <CardHeader
            title="Campaign details"
            description="Use {{name}} in the body for personalization."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Segment *" htmlFor="campaign-segment">
              <Select
                id="campaign-segment"
                name="segmentId"
                required
                defaultValue=""
              >
                <option value="" disabled>
                  Select segment
                </option>
                {segments.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Campaign name *" htmlFor="campaign-name">
              <Input
                id="campaign-name"
                name="name"
                required
                placeholder="Summer sale"
              />
            </Field>
            <Field
              label="Email subject *"
              htmlFor="campaign-subject"
              className="sm:col-span-2"
            >
              <Input
                id="campaign-subject"
                name="subject"
                required
                placeholder="Don't miss our summer sale"
              />
            </Field>
            <Field
              label="HTML body *"
              htmlFor="campaign-body"
              className="sm:col-span-2"
            >
              <Textarea
                id="campaign-body"
                name="bodyHtml"
                required
                rows={8}
                placeholder="<p>Hi {{name}}, ...</p>"
              />
            </Field>
          </div>
        </Card>

        <ActionBar>
          <span />
          <div className="flex items-center gap-3">
            <Link
              to="/admin/marketing"
              className="text-text-muted hover:text-text text-sm transition-colors"
            >
              Cancel
            </Link>
            <ButtonSubmit disabled={isSaving}>
              {isSaving ? 'Creating…' : 'Create campaign'}
            </ButtonSubmit>
          </div>
        </ActionBar>
      </Form>
    </div>
  );
}
