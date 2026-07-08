import { readPluginData, writePluginData } from '#/core/plugins/data.server';

import manifest from '#/plugins/sample-analytics/manifest';

export const PLUGIN_ID = manifest.id;
export const EVENTS_KEY = 'recentEvents';
const MAX_EVENTS = 100;

export async function loadRecentEvents() {
  const events = await readPluginData(PLUGIN_ID, EVENTS_KEY, []);
  return Array.isArray(events) ? events : [];
}

export async function appendRecentEvent(payload) {
  const existing = await loadRecentEvents();
  const event = {
    type: 'order.created',
    orderId: payload.orderId,
    orderNumber: payload.orderNumber,
    totalCents: payload.totalCents,
    currency: payload.currency,
    capturedAt: new Date().toISOString(),
  };
  await writePluginData(
    PLUGIN_ID,
    EVENTS_KEY,
    [event, ...existing].slice(0, MAX_EVENTS)
  );
}
