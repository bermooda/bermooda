import { loadRecentEvents } from '../../data/index.server';
import { AnalyticsPage } from '../analytics-page';

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
