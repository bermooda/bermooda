import prisma from '#/libs/prisma.server';

import { AnalyticsPage } from '#/plugins/sample-analytics/storefront/analytics-page';

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

      return {
        eventCount: events.length,
        latestEvent: events[0] ?? null,
      };
    },
    Component: AnalyticsPage,
  },
];
