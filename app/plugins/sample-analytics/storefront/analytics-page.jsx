export function AnalyticsPage({ loaderData }) {
  const eventCount = loaderData?.eventCount ?? 0;
  const latestEvent = loaderData?.latestEvent ?? null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
      <div className="rounded-3xl border border-stone-200 bg-white p-8 shadow-sm">
        <span className="text-xs font-semibold tracking-[0.3em] text-stone-500 uppercase">
          Sample Analytics
        </span>
        <h1 className="mt-4 font-serif text-4xl tracking-tight text-stone-900">
          Storefront event snapshot
        </h1>
        <p className="mt-3 text-base leading-7 text-stone-600">
          {eventCount > 0
            ? `This plugin has captured ${eventCount} recent order events.`
            : 'No analytics events have been captured yet.'}
        </p>

        {latestEvent ? (
          <div className="mt-8 rounded-2xl border border-stone-200 bg-stone-50 p-5">
            <p className="text-sm font-medium text-stone-900">Latest event</p>
            <dl className="mt-4 grid gap-3 text-sm text-stone-600 sm:grid-cols-2">
              <div>
                <dt className="font-medium text-stone-900">Order number</dt>
                <dd>{latestEvent.orderNumber ?? '—'}</dd>
              </div>
              <div>
                <dt className="font-medium text-stone-900">Currency</dt>
                <dd>{latestEvent.currency ?? '—'}</dd>
              </div>
              <div>
                <dt className="font-medium text-stone-900">Total</dt>
                <dd>{latestEvent.totalCents ?? '—'}</dd>
              </div>
              <div>
                <dt className="font-medium text-stone-900">Captured at</dt>
                <dd>{latestEvent.capturedAt ?? '—'}</dd>
              </div>
            </dl>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default AnalyticsPage;
