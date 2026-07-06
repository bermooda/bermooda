import {
  Form,
  Link,
  redirect,
  useActionData,
  useNavigation,
} from 'react-router';

import { createAbandonedCartSequence } from '#/core/marketing/index.server';
import ActionBar from '#/components/admin/action-bar';
import Breadcrumbs from '#/components/admin/breadcrumbs';
import Card, { CardHeader } from '#/components/admin/card';
import Field from '#/components/admin/form/field';
import Input from '#/components/admin/form/input';
import PageHeader from '#/components/admin/page-header';
import { ErrorAlert } from '#/components/ui/alert';
import { ButtonSubmit } from '#/components/ui/button';

export async function action({ request }) {
  const formData = await request.formData();
  const name = formData.get('name')?.toString().trim();
  const stepNumber = parseInt(
    formData.get('stepNumber')?.toString() ?? '1',
    10
  );
  const delayMinutes = parseInt(
    formData.get('delayMinutes')?.toString() ?? '60',
    10
  );
  const subject = formData.get('subject')?.toString().trim();

  if (!name || !subject) {
    return { error: 'Sequence name and subject are required.' };
  }

  await createAbandonedCartSequence({
    name,
    stepNumber,
    delayMinutes,
    subject,
  });

  return redirect('/admin/marketing');
}

export default function AdminNewMarketingSequenceRoute() {
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
              { label: 'New sequence step' },
            ]}
          />
        }
        title="New abandoned cart step"
        subtitle="Add a step to the abandoned cart email sequence."
      />

      <ErrorAlert message={actionData?.error} />

      <Form method="post" className="space-y-6">
        <Card>
          <CardHeader
            title="Sequence step"
            description="Configure when and what email is sent after cart abandonment."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Step name *" htmlFor="sequence-name">
              <Input
                id="sequence-name"
                name="name"
                required
                placeholder="Reminder 1"
              />
            </Field>
            <Field label="Step number" htmlFor="sequence-step">
              <Input
                id="sequence-step"
                name="stepNumber"
                type="number"
                min="1"
                defaultValue="1"
              />
            </Field>
            <Field label="Delay (minutes)" htmlFor="sequence-delay">
              <Input
                id="sequence-delay"
                name="delayMinutes"
                type="number"
                min="1"
                defaultValue="60"
              />
            </Field>
            <Field label="Email subject *" htmlFor="sequence-subject">
              <Input
                id="sequence-subject"
                name="subject"
                required
                placeholder="You left something behind"
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
              {isSaving ? 'Creating…' : 'Add sequence step'}
            </ButtonSubmit>
          </div>
        </ActionBar>
      </Form>
    </div>
  );
}
