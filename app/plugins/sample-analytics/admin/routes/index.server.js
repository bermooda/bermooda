import { RecentEventsPage } from '../recent-events-page';
import { loadRecentEvents } from '../../data/index.server';

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
