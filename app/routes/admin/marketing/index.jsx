// app/routes/admin/marketing/index.jsx

import { PlusIcon } from '@heroicons/react/24/outline';
import { Form, Link, useLoaderData } from 'react-router';

import Card from '#/components/admin/card';
import PageHeader from '#/components/admin/page-header';

import {
  listAbandonedCartSequences,
  listCampaigns,
  listSegments,
  sendCampaign,
} from '#/core/marketing/index.server';

export async function loader() {
  const [segments, campaigns, sequences] = await Promise.all([
    listSegments(),
    listCampaigns(),
    listAbandonedCartSequences(),
  ]);
  return { segments, campaigns, sequences };
}

export async function action({ request }) {
  const formData = await request.formData();
  const intent = formData.get('intent');

  if (intent === 'send-campaign') {
    const campaignId = formData.get('campaignId')?.toString();
    if (!campaignId) return { ok: false, error: 'Campaign required.' };
    const result = await sendCampaign(campaignId);
    return { ok: true, sent: result.sent };
  }

  return { ok: false, error: 'Unknown action.' };
}

const CTA_CLASS =
  'bg-accent text-accent-fg hover:bg-accent-hover focus-visible:outline-accent inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold shadow-sm transition focus-visible:outline focus-visible:outline-offset-2';

export default function AdminMarketingRoute() {
  const { segments, campaigns, sequences } = useLoaderData();

  return (
    <div>
      <PageHeader
        title="Marketing automation"
        subtitle="Segments, email campaigns, and abandoned-cart sequences."
        className="mb-6"
      />

      <div className="space-y-6">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-text text-lg font-semibold">Segments</h2>
            <Link to="/admin/marketing/segments/new" className={CTA_CLASS}>
              <PlusIcon className="h-4 w-4" />
              New segment
            </Link>
          </div>
          <ul className="text-text-muted mt-4 space-y-1 text-sm">
            {segments.length === 0 ? (
              <li>
                No segments yet.{' '}
                <Link
                  to="/admin/marketing/segments/new"
                  className="text-accent hover:underline"
                >
                  Create your first segment
                </Link>
                .
              </li>
            ) : (
              segments.map((s) => (
                <li key={s.id}>
                  {s.name} ({s._count.campaigns} campaigns)
                </li>
              ))
            )}
          </ul>
        </Card>

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-text text-lg font-semibold">Campaigns</h2>
            <Link to="/admin/marketing/campaigns/new" className={CTA_CLASS}>
              <PlusIcon className="h-4 w-4" />
              New campaign
            </Link>
          </div>
          <ul className="text-text-muted mt-4 space-y-2 text-sm">
            {campaigns.length === 0 ? (
              <li>
                No campaigns yet.{' '}
                <Link
                  to="/admin/marketing/campaigns/new"
                  className="text-accent hover:underline"
                >
                  Create your first campaign
                </Link>
                .
              </li>
            ) : (
              campaigns.map((c) => (
                <li key={c.id} className="flex items-center gap-3">
                  <span>
                    {c.name} — {c.status} ({c._count.deliveries} deliveries)
                  </span>
                  {c.status !== 'sent' && (
                    <Form method="post">
                      <input
                        type="hidden"
                        name="intent"
                        value="send-campaign"
                      />
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
              ))
            )}
          </ul>
        </Card>

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-text text-lg font-semibold">
              Abandoned cart sequences
            </h2>
            <Link to="/admin/marketing/sequences/new" className={CTA_CLASS}>
              <PlusIcon className="h-4 w-4" />
              New step
            </Link>
          </div>
          <ul className="text-text-muted mt-4 space-y-1 text-sm">
            {sequences.length === 0 ? (
              <li>
                No sequence steps yet.{' '}
                <Link
                  to="/admin/marketing/sequences/new"
                  className="text-accent hover:underline"
                >
                  Add your first step
                </Link>
                .
              </li>
            ) : (
              sequences.map((s) => (
                <li key={s.id}>
                  Step {s.stepNumber}: {s.name} — after {s.delayMinutes}m (
                  {s.active ? 'active' : 'inactive'})
                </li>
              ))
            )}
          </ul>
        </Card>
      </div>
    </div>
  );
}
