import { loadRecentEvents } from '../../data/index.server';
import { RecentEventsPage } from '../recent-events-page';

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
