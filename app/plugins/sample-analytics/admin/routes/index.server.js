import { RecentEventsPage } from '#/plugins/sample-analytics/admin/recent-events-page';
import { loadRecentEvents } from '#/plugins/sample-analytics/data/index.server';

export const routes = [
  {
    path: '',
    async loader() {
      const events = await loadRecentEvents();
      return { events };
    },
    Component: RecentEventsPage,
  },
];
