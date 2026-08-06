/**
 * Ops: audit log, webhook subscriptions/deliveries, scheduled exports.
 */

import { daysAgo } from './helpers.js';

/**
 * @param {import('../generated/client.ts').PrismaClient} prisma
 * @param {{ adminEmail?: string, adminUserId?: string }} [actor]
 */
export async function seedOps(prisma, actor = {}) {
  const adminEmail = actor.adminEmail ?? 'admin@bermooda.dev';
  const adminUserId = actor.adminUserId ?? null;

  const auditEntries = [
    {
      id: 'seed-audit-01',
      action: 'order.fulfilled',
      entityType: 'order',
      entityId: 'seed-order-06',
      daysAgo: 8,
    },
    {
      id: 'seed-audit-02',
      action: 'product.updated',
      entityType: 'product',
      entityId: 'seed-prod-bamboo-speaker',
      daysAgo: 3,
      diffJson: JSON.stringify({ inventoryCount: { from: 75, to: 80 } }),
    },
    {
      id: 'seed-audit-03',
      action: 'discount.created',
      entityType: 'discount',
      entityId: 'seed-discount-welcome10',
      daysAgo: 20,
    },
    {
      id: 'seed-audit-04',
      action: 'settings.updated',
      entityType: 'setting',
      entityId: 'shopName',
      daysAgo: 2,
    },
    {
      id: 'seed-audit-05',
      action: 'customer.created',
      entityType: 'customer',
      entityId: 'seed-customer-01',
      daysAgo: 40,
    },
    {
      id: 'seed-audit-06',
      action: 'refund.succeeded',
      entityType: 'refund',
      entityId: 'seed-refund-09',
      daysAgo: 15,
    },
  ];

  for (const entry of auditEntries) {
    await prisma.auditLog.upsert({
      where: { id: entry.id },
      create: {
        id: entry.id,
        actorType: 'admin',
        actorId: adminUserId,
        actorEmail: adminEmail,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        diffJson: entry.diffJson ?? null,
        createdAt: daysAgo(entry.daysAgo),
      },
      update: {
        action: entry.action,
        actorEmail: adminEmail,
        actorId: adminUserId,
      },
    });
  }

  const subscription = await prisma.webhookSubscription.upsert({
    where: { id: 'seed-wh-sub-orders' },
    create: {
      id: 'seed-wh-sub-orders',
      label: 'Order events (demo)',
      url: 'https://example.com/webhooks/bermooda',
      events: JSON.stringify([
        'order.created',
        'order.fulfilled',
        'order.refunded',
      ]),
      secret: 'seed_whsec_demo_not_for_production',
      active: true,
    },
    update: {
      label: 'Order events (demo)',
      active: true,
      events: JSON.stringify([
        'order.created',
        'order.fulfilled',
        'order.refunded',
      ]),
    },
  });

  await prisma.webhookDelivery.upsert({
    where: { id: 'seed-wh-del-01' },
    create: {
      id: 'seed-wh-del-01',
      subscriptionId: subscription.id,
      event: 'order.created',
      payload: JSON.stringify({ orderNumber: 'DEMO-1006' }),
      status: 'delivered',
      attempts: 1,
      lastAttemptAt: daysAgo(8),
      responseStatus: 200,
      responseBody: 'ok',
    },
    update: { status: 'delivered', responseStatus: 200 },
  });

  await prisma.webhookDelivery.upsert({
    where: { id: 'seed-wh-del-02' },
    create: {
      id: 'seed-wh-del-02',
      subscriptionId: subscription.id,
      event: 'order.fulfilled',
      payload: JSON.stringify({ orderNumber: 'DEMO-1006' }),
      status: 'failed',
      attempts: 3,
      lastAttemptAt: daysAgo(7),
      responseStatus: 500,
      error: 'upstream timeout',
    },
    update: { status: 'failed', attempts: 3 },
  });

  await prisma.webhookEvent.upsert({
    where: {
      provider_eventId: {
        provider: 'stripe',
        eventId: 'seed_evt_demo_001',
      },
    },
    create: {
      id: 'seed-wh-evt-01',
      provider: 'stripe',
      eventId: 'seed_evt_demo_001',
      type: 'payment_intent.succeeded',
      payload: JSON.stringify({ id: 'seed_pi_demo' }),
      processedAt: daysAgo(4),
    },
    update: {
      type: 'payment_intent.succeeded',
      processedAt: daysAgo(4),
    },
  });

  const scheduled = await prisma.scheduledExport.upsert({
    where: { id: 'seed-export-orders-weekly' },
    create: {
      id: 'seed-export-orders-weekly',
      label: 'Weekly orders CSV',
      exportType: 'orders',
      filtersJson: JSON.stringify({ status: 'fulfilled' }),
      schedule: '0 9 * * 1',
      recipientEmail: adminEmail,
      lastRunAt: daysAgo(3),
      active: true,
    },
    update: {
      label: 'Weekly orders CSV',
      active: true,
      recipientEmail: adminEmail,
      lastRunAt: daysAgo(3),
    },
  });

  await prisma.exportRun.upsert({
    where: { id: 'seed-export-run-01' },
    create: {
      id: 'seed-export-run-01',
      scheduledExportId: scheduled.id,
      exportType: 'orders',
      status: 'completed',
      rowCount: 12,
      completedAt: daysAgo(3),
      createdAt: daysAgo(3),
    },
    update: {
      status: 'completed',
      rowCount: 12,
    },
  });

  await prisma.exportRun.upsert({
    where: { id: 'seed-export-run-02' },
    create: {
      id: 'seed-export-run-02',
      scheduledExportId: scheduled.id,
      exportType: 'orders',
      status: 'failed',
      rowCount: 0,
      error: 'Disk full (demo)',
      createdAt: daysAgo(10),
      completedAt: daysAgo(10),
    },
    update: {
      status: 'failed',
      error: 'Disk full (demo)',
    },
  });

  // Digital asset on herbal tea (downloadable companion)
  await prisma.digitalAsset.upsert({
    where: { id: 'seed-digital-tea-guide' },
    create: {
      id: 'seed-digital-tea-guide',
      productId: 'seed-prod-herbal-tea',
      fileName: 'brewing-guide.pdf',
      filePath: 'demo/brewing-guide.pdf',
      fileSize: 245760,
      mimeType: 'application/pdf',
    },
    update: {
      fileName: 'brewing-guide.pdf',
      filePath: 'demo/brewing-guide.pdf',
    },
  });

  console.log('Seeded audit log, webhooks, exports, and a digital asset.');
}
