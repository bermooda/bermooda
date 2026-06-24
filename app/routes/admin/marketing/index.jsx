// app/routes/admin/marketing/index.jsx

import { Form, useLoaderData } from 'react-router';

import Card from '#/components/admin/card';
import Input from '#/components/admin/form/input';
import Select from '#/components/admin/form/select';
import Textarea from '#/components/admin/form/textarea';
import PageHeader from '#/components/admin/page-header';
import Button from '#/components/ui/button';

import {
  createAbandonedCartSequence,
  createCampaign,
  createSegment,
  listAbandonedCartSequences,
  listCampaigns,
  listSegments,
  sendCampaign,
} from '#/core/marketing/index.server';
import { listCustomerGroups } from '#/core/pricing/index.server';

export async function loader() {
  const [segments, campaigns, sequences, groups] = await Promise.all([
    listSegments(),
    listCampaigns(),
    listAbandonedCartSequences(),
    listCustomerGroups(),
  ]);
  return { segments, campaigns, sequences, groups };
}

export async function action({ request }) {
  const formData = await request.formData();
  const intent = formData.get('intent');

  if (intent === 'create-segment') {
    const name = formData.get('name')?.toString().trim();
    const minOrders = formData.get('minOrders')?.toString();
    const minSpentCents = formData.get('minSpentCents')?.toString();
    const customerGroupId = formData.get('customerGroupId')?.toString();
    if (!name) return { ok: false, error: 'Segment name is required.' };

    const rules = {};
    if (minOrders) rules.minOrders = parseInt(minOrders, 10);
    if (minSpentCents) rules.minSpentCents = parseInt(minSpentCents, 10);
    if (customerGroupId) rules.customerGroupId = customerGroupId;

    await createSegment({ name, rules });
    return { ok: true };
  }

  if (intent === 'create-campaign') {
    const segmentId = formData.get('segmentId')?.toString();
    const name = formData.get('name')?.toString().trim();
    const subject = formData.get('subject')?.toString().trim();
    const bodyHtml = formData.get('bodyHtml')?.toString().trim();
    if (!segmentId || !name || !subject || !bodyHtml) {
      return { ok: false, error: 'All campaign fields are required.' };
    }
    await createCampaign({ segmentId, name, subject, bodyHtml });
    return { ok: true };
  }

  if (intent === 'send-campaign') {
    const campaignId = formData.get('campaignId')?.toString();
    if (!campaignId) return { ok: false, error: 'Campaign required.' };
    const result = await sendCampaign(campaignId);
    return { ok: true, sent: result.sent };
  }

  if (intent === 'create-sequence') {
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
      return { ok: false, error: 'Sequence name and subject are required.' };
    }
    await createAbandonedCartSequence({
      name,
      stepNumber,
      delayMinutes,
      subject,
    });
    return { ok: true };
  }

  return { ok: false, error: 'Unknown action.' };
}

export default function AdminMarketingRoute() {
  const { segments, campaigns, sequences, groups } = useLoaderData();

  return (
    <div>
      <PageHeader
        title="Marketing automation"
        subtitle="Segments, email campaigns, and abandoned-cart sequences."
        className="mb-6"
      />

      <div className="space-y-6">
        <Card>
          <h2 className="text-text text-lg font-semibold">Segments</h2>
          <Form method="post" className="mt-4 flex flex-wrap items-end gap-3">
            <input type="hidden" name="intent" value="create-segment" />
            <Input name="name" placeholder="Segment name" className="w-auto" />
            <Input
              name="minOrders"
              type="number"
              min="0"
              placeholder="Min orders"
              className="w-28"
            />
            <Input
              name="minSpentCents"
              type="number"
              min="0"
              placeholder="Min spent (cents)"
              className="w-36"
            />
            <Select name="customerGroupId" className="w-auto">
              <option value="">Any group</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
            <Button type="submit" variant="primary">
              Create segment
            </Button>
          </Form>
          <ul className="text-text-muted mt-4 space-y-1 text-sm">
            {segments.map((s) => (
              <li key={s.id}>
                {s.name} ({s._count.campaigns} campaigns)
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <h2 className="text-text text-lg font-semibold">Campaigns</h2>
          <Form method="post" className="mt-4 grid gap-3 md:grid-cols-2">
            <input type="hidden" name="intent" value="create-campaign" />
            <Select name="segmentId">
              <option value="">Select segment</option>
              {segments.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            <Input name="name" placeholder="Campaign name" />
            <Input name="subject" placeholder="Email subject" />
            <Textarea
              name="bodyHtml"
              placeholder="HTML body (use {{name}})"
              rows={3}
              className="md:col-span-2"
            />
            <Button type="submit" variant="primary" className="md:w-fit">
              Create campaign
            </Button>
          </Form>
          <ul className="text-text-muted mt-4 space-y-2 text-sm">
            {campaigns.map((c) => (
              <li key={c.id} className="flex items-center gap-3">
                <span>
                  {c.name} — {c.status} ({c._count.deliveries} deliveries)
                </span>
                {c.status !== 'sent' && (
                  <Form method="post">
                    <input type="hidden" name="intent" value="send-campaign" />
                    <input type="hidden" name="campaignId" value={c.id} />
                    <button
                      type="submit"
                      className="text-accent hover:underline"
                    >
                      Send
                    </button>
                  </Form>
                )}
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <h2 className="text-text text-lg font-semibold">
            Abandoned cart sequences
          </h2>
          <Form method="post" className="mt-4 flex flex-wrap items-end gap-3">
            <input type="hidden" name="intent" value="create-sequence" />
            <Input name="name" placeholder="Step name" className="w-auto" />
            <Input
              name="stepNumber"
              type="number"
              min="1"
              placeholder="Step #"
              className="w-20"
            />
            <Input
              name="delayMinutes"
              type="number"
              min="1"
              placeholder="Delay (min)"
              className="w-28"
            />
            <Input
              name="subject"
              placeholder="Email subject"
              className="w-auto"
            />
            <Button type="submit" variant="primary">
              Add step
            </Button>
          </Form>
          <ul className="text-text-muted mt-4 space-y-1 text-sm">
            {sequences.map((s) => (
              <li key={s.id}>
                Step {s.stepNumber}: {s.name} — after {s.delayMinutes}m (
                {s.active ? 'active' : 'inactive'})
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
