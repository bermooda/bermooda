import {
  Form,
  Link,
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
import ActionBar from '#/components/admin/action-bar';
import Breadcrumbs from '#/components/admin/breadcrumbs';
import Card, { CardHeader } from '#/components/admin/card';
import Field from '#/components/admin/form/field';
import Input from '#/components/admin/form/input';
import Select from '#/components/admin/form/select';
import PageHeader from '#/components/admin/page-header';
import { ErrorAlert } from '#/components/ui/alert';
import { ButtonSubmit } from '#/components/ui/button';

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
    <div className="mx-auto max-w-6xl">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Marketing', href: '/admin/marketing' },
              { label: 'New segment' },
            ]}
          />
        }
        title="New segment"
        subtitle="Define a customer segment for targeted campaigns."
      />

      <ErrorAlert message={actionData?.error} />

      <Form method="post" className="space-y-6">
        <Card>
          <CardHeader
            title="Segment rules"
            description="All filters are optional. Customers must match all specified rules."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name *" htmlFor="segment-name">
              <Input
                id="segment-name"
                name="name"
                required
                placeholder="VIP customers"
              />
            </Field>
            <Field label="Min orders" htmlFor="segment-min-orders">
              <Input
                id="segment-min-orders"
                name="minOrders"
                type="number"
                min="0"
                placeholder="3"
              />
            </Field>
            <Field label="Min spent (cents)" htmlFor="segment-min-spent">
              <Input
                id="segment-min-spent"
                name="minSpentCents"
                type="number"
                min="0"
                placeholder="10000"
              />
            </Field>
            <Field label="Customer group" htmlFor="segment-group">
              <Select id="segment-group" name="customerGroupId" defaultValue="">
                <option value="">Any group</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </Select>
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
              {isSaving ? 'Creating…' : 'Create segment'}
            </ButtonSubmit>
          </div>
        </ActionBar>
      </Form>
    </div>
  );
}
