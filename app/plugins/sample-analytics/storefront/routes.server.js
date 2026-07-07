import { loadRecentEvents } from '#/plugins/sample-analytics/data.server';
import { AnalyticsPage } from '#/plugins/sample-analytics/storefront/analytics-page';

export const routes = [
  {
    path: '',
    async loader() {
      const events = await loadRecentEvents();

      return {
        eventCount: events.length,
        latestEvent: events[0] ?? null,
      };
    },
    Component: AnalyticsPage,
  },
];
