// app/routes/admin/channels/index.jsx

import { Form, useLoaderData } from 'react-router';

import prisma from '#/libs/prisma.server';

import {
  createChannel,
  listChannels,
  setChannelPriceOverride,
  setChannelProductPublished,
  updateChannel,
} from '#/core/channels/index.server';

export async function loader() {
  const { channels, total } = await listChannels({ limit: 100 });
  const products = await prisma.product.findMany({
    take: 50,
    orderBy: { createdAt: 'desc' },
    include: { variants: { include: { prices: true } } },
  });
  return { channels, total, products };
}

export async function action({ request }) {
  const formData = await request.formData();
  const intent = formData.get('intent');

  if (intent === 'create-channel') {
    const name = formData.get('name')?.toString().trim();
    const handle = formData.get('handle')?.toString().trim().toLowerCase();
    const domain = formData.get('domain')?.toString().trim() || null;
    const currency = formData.get('currency')?.toString().trim() || 'USD';
    const locale = formData.get('locale')?.toString().trim() || 'en';
    if (!name || !handle) {
      return { ok: false, error: 'Name and handle are required.' };
    }
    await createChannel({ name, handle, domain, currency, locale });
    return { ok: true };
  }

  if (intent === 'toggle-product') {
    const channelId = formData.get('channelId')?.toString();
    const productId = formData.get('productId')?.toString();
    const published = formData.get('published') === 'true';
    if (!channelId || !productId) {
      return { ok: false, error: 'Channel and product required.' };
    }
    await setChannelProductPublished(channelId, productId, published);
    return { ok: true };
  }

  if (intent === 'set-price') {
    const channelId = formData.get('channelId')?.toString();
    const variantId = formData.get('variantId')?.toString();
    const currency = formData.get('currency')?.toString().trim() || 'USD';
    const priceCents = parseInt(
      formData.get('priceCents')?.toString() ?? '0',
      10
    );
    if (!channelId || !variantId || !priceCents) {
      return { ok: false, error: 'Channel, variant, and price required.' };
    }
    await setChannelPriceOverride(channelId, variantId, currency, priceCents);
    return { ok: true };
  }

  if (intent === 'set-default') {
    const channelId = formData.get('channelId')?.toString();
    if (!channelId) return { ok: false, error: 'Channel required.' };
    await updateChannel(channelId, { isDefault: true });
    return { ok: true };
  }

  return { ok: false, error: 'Unknown action.' };
}

export default function AdminChannelsRoute() {
  const { channels, total, products } = useLoaderData();
  const nonDefaultChannels = channels.filter((c) => !c.isDefault);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
          Sales channels
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Multi-storefront channels with per-domain routing and catalog
          overrides.
        </p>
      </div>

      <Form method="post" className="flex flex-wrap gap-3">
        <input type="hidden" name="intent" value="create-channel" />
        <input
          name="name"
          placeholder="Channel name"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
        />
        <input
          name="handle"
          placeholder="handle"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
        />
        <input
          name="domain"
          placeholder="domain (optional)"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
        />
        <input
          name="currency"
          defaultValue="USD"
          className="w-20 rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
        />
        <input
          name="locale"
          defaultValue="en"
          className="w-16 rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
        />
        <button
          type="submit"
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm text-white"
        >
          Create channel
        </button>
      </Form>

      <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-lg font-medium">Channels ({total})</h2>
        <table className="mt-4 w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700">
              <th className="py-2">Name</th>
              <th className="py-2">Handle</th>
              <th className="py-2">Domain</th>
              <th className="py-2">Currency</th>
              <th className="py-2">Default</th>
            </tr>
          </thead>
          <tbody>
            {channels.map((channel) => (
              <tr key={channel.id} className="border-b border-slate-100">
                <td className="py-2">{channel.name}</td>
                <td className="py-2">{channel.handle}</td>
                <td className="py-2">{channel.domain ?? '—'}</td>
                <td className="py-2">{channel.currency}</td>
                <td className="py-2">
                  {channel.isDefault ? (
                    'Yes'
                  ) : (
                    <Form method="post">
                      <input type="hidden" name="intent" value="set-default" />
                      <input
                        type="hidden"
                        name="channelId"
                        value={channel.id}
                      />
                      <button
                        type="submit"
                        className="text-indigo-600 hover:underline"
                      >
                        Set default
                      </button>
                    </Form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {nonDefaultChannels.length > 0 && products.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-lg font-medium">Channel price override</h2>
          <Form method="post" className="mt-4 flex flex-wrap gap-3">
            <input type="hidden" name="intent" value="set-price" />
            <select
              name="channelId"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
            >
              {nonDefaultChannels.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              name="variantId"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
            >
              {products.flatMap((p) =>
                p.variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.sku ?? v.id}
                  </option>
                ))
              )}
            </select>
            <input
              name="priceCents"
              type="number"
              min="1"
              placeholder="Price (cents)"
              className="w-32 rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
            />
            <input
              name="currency"
              defaultValue="USD"
              className="w-20 rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
            />
            <button
              type="submit"
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm text-white"
            >
              Set override
            </button>
          </Form>
        </section>
      )}
    </div>
  );
}
