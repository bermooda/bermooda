import { useT } from '#/core/i18n';

export function AnalyticsPage({ loaderData }) {
  const t = useT();
  const eventCount = loaderData?.eventCount ?? 0;
  const latestEvent = loaderData?.latestEvent ?? null;
  const emptyValue = t('sampleAnalytics.storefront.emptyValue');

  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
      <div className="rounded-3xl border border-stone-200 bg-white p-8 shadow-sm">
        <span className="text-xs font-semibold tracking-[0.3em] text-stone-500 uppercase">
          {t('sampleAnalytics.storefront.badge')}
        </span>
        <h1 className="mt-4 font-serif text-4xl tracking-tight text-stone-900">
          {t('sampleAnalytics.storefront.title')}
        </h1>
        <p className="mt-3 text-base leading-7 text-stone-600">
          {eventCount > 0
            ? t('sampleAnalytics.storefront.hasEvents', { count: eventCount })
            : t('sampleAnalytics.storefront.noEvents')}
        </p>

        {latestEvent ? (
          <div className="mt-8 rounded-2xl border border-stone-200 bg-stone-50 p-5">
            <p className="text-sm font-medium text-stone-900">
              {t('sampleAnalytics.storefront.latestEvent')}
            </p>
            <dl className="mt-4 grid gap-3 text-sm text-stone-600 sm:grid-cols-2">
              <div>
                <dt className="font-medium text-stone-900">
                  {t('sampleAnalytics.storefront.orderNumber')}
                </dt>
                <dd>{latestEvent.orderNumber ?? emptyValue}</dd>
              </div>
              <div>
                <dt className="font-medium text-stone-900">
                  {t('sampleAnalytics.storefront.currency')}
                </dt>
                <dd>{latestEvent.currency ?? emptyValue}</dd>
              </div>
              <div>
                <dt className="font-medium text-stone-900">
                  {t('sampleAnalytics.storefront.total')}
                </dt>
                <dd>{latestEvent.totalCents ?? emptyValue}</dd>
              </div>
              <div>
                <dt className="font-medium text-stone-900">
                  {t('sampleAnalytics.storefront.capturedAt')}
                </dt>
                <dd>{latestEvent.capturedAt ?? emptyValue}</dd>
              </div>
            </dl>
          </div>
        ) : null}
      </div>
    </div>
  );
}
