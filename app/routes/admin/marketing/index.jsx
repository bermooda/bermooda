// app/routes/admin/marketing/index.jsx

import { PlusIcon } from '@heroicons/react/24/outline';
import { Form, Link, useLoaderData } from 'react-router';

import { useT } from '#/core/i18n';
import {
  listAbandonedCartSequences,
  listCampaigns,
  listSegments,
  sendCampaign,
} from '#/core/marketing/index.server';
import { queueAbandonedCartSequence } from '#/core/marketing/job.server';
import Card from '#/components/admin/card';
import PageHeader from '#/components/admin/page-header';

export async function loader() {
  const [segmentsResult, campaignsResult, sequencesResult] = await Promise.all([
    listSegments({ limit: 100 }),
    listCampaigns({ limit: 100 }),
    listAbandonedCartSequences({ limit: 100 }),
  ]);
  return {
    segments: segmentsResult.segments,
    campaigns: campaignsResult.campaigns,
    sequences: sequencesResult.sequences,
  };
}

export async function action({ request }) {
  const formData = await request.formData();
  const intent = formData.get('intent');

  if (intent === 'send-campaign') {
    const campaignId = formData.get('campaignId')?.toString();
    if (!campaignId) return { ok: false, error: 'Campaign required.' };

    try {
      const result = await sendCampaign(campaignId);
      return { ok: true, sent: result.sent };
    } catch (err) {
      if (err.code === 'NOT_FOUND') {
        return { ok: false, error: 'Campaign not found.' };
      }
      if (err.code === 'CAMPAIGN_ALREADY_SENT') {
        return { ok: false, error: 'Campaign was already sent.' };
      }
      throw err;
    }
  }

  if (intent === 'run-abandoned-cart-sequence') {
    queueAbandonedCartSequence();
    return { ok: true, intent, queued: true };
  }

  return { ok: false, error: 'Unknown action.' };
}

const CTA_CLASS =
  'bg-accent text-accent-fg hover:bg-accent-hover focus-visible:outline-accent inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold shadow-sm transition focus-visible:outline focus-visible:outline-offset-2';

export default function AdminMarketingRoute() {
  const t = useT();
  const { segments, campaigns, sequences } = useLoaderData();

  return (
    <div>
      <PageHeader
        title={t('admin.marketing.index.title')}
        subtitle={t('admin.marketing.index.subtitle')}
        className="mb-6"
      />

      <div className="space-y-6">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-text text-lg font-semibold">
              {t('admin.marketing.index.segments')}
            </h2>
            <Link to="/admin/marketing/segments/new" className={CTA_CLASS}>
              <PlusIcon className="h-4 w-4" />
              {t('admin.marketing.index.newSegment')}
            </Link>
          </div>
          <ul className="text-text-muted mt-4 space-y-1 text-sm">
            {segments.length === 0 ? (
              <li>
                {t('admin.marketing.index.noSegments')}{' '}
                <Link
                  to="/admin/marketing/segments/new"
                  className="text-accent hover:underline"
                >
                  {t('admin.marketing.index.createFirstSegment')}
                </Link>
                .
              </li>
            ) : (
              segments.map((s) => (
                <li key={s.id}>
                  {t('admin.marketing.index.segmentMeta', {
                    name: s.name,
                    count: s._count.campaigns,
                  })}
                </li>
              ))
            )}
          </ul>
        </Card>

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-text text-lg font-semibold">
              {t('admin.marketing.index.campaigns')}
            </h2>
            <Link to="/admin/marketing/campaigns/new" className={CTA_CLASS}>
              <PlusIcon className="h-4 w-4" />
              {t('admin.marketing.index.newCampaign')}
            </Link>
          </div>
          <ul className="text-text-muted mt-4 space-y-2 text-sm">
            {campaigns.length === 0 ? (
              <li>
                {t('admin.marketing.index.noCampaigns')}{' '}
                <Link
                  to="/admin/marketing/campaigns/new"
                  className="text-accent hover:underline"
                >
                  {t('admin.marketing.index.createFirstCampaign')}
                </Link>
                .
              </li>
            ) : (
              campaigns.map((c) => (
                <li key={c.id} className="flex items-center gap-3">
                  <span>
                    {t('admin.marketing.index.campaignMeta', {
                      name: c.name,
                      status: c.status,
                      count: c._count.deliveries,
                    })}
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
                        {t('admin.marketing.index.send')}
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
              {t('admin.marketing.index.sequences')}
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <Form method="post">
                <input
                  type="hidden"
                  name="intent"
                  value="run-abandoned-cart-sequence"
                />
                <button type="submit" className={CTA_CLASS}>
                  {t('admin.marketing.index.runNow')}
                </button>
              </Form>
              <Link to="/admin/marketing/sequences/new" className={CTA_CLASS}>
                <PlusIcon className="h-4 w-4" />
                {t('admin.marketing.index.newStep')}
              </Link>
            </div>
          </div>
          <ul className="text-text-muted mt-4 space-y-1 text-sm">
            {sequences.length === 0 ? (
              <li>
                {t('admin.marketing.index.noSequences')}{' '}
                <Link
                  to="/admin/marketing/sequences/new"
                  className="text-accent hover:underline"
                >
                  {t('admin.marketing.index.addFirstStep')}
                </Link>
                .
              </li>
            ) : (
              sequences.map((s) => (
                <li key={s.id}>
                  {t('admin.marketing.index.sequenceMeta', {
                    step: s.stepNumber,
                    name: s.name,
                    delay: s.delayMinutes,
                    status: s.active
                      ? t('admin.marketing.index.active')
                      : t('admin.marketing.index.inactive'),
                  })}
                </li>
              ))
            )}
          </ul>
        </Card>
      </div>
    </div>
  );
}
