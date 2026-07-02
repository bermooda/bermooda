import prisma from '#/libs/prisma.server';

import { RecentEventsPage } from '#/plugins/sample-analytics/admin/recent-events-page';

const PLUGIN_ID = 'sample-analytics';
const EVENTS_KEY = 'recentEvents';

export const routes = [
  {
    path: '',
    async loader() {
      const row = await prisma.pluginData.findUnique({
        where: { pluginId_key: { pluginId: PLUGIN_ID, key: EVENTS_KEY } },
      });
      const events = row ? JSON.parse(row.value) : [];
      return { events };
    },
    Component: RecentEventsPage,
  },
];
