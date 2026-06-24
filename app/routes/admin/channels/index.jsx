// app/routes/admin/channels/index.jsx

import { Form, useLoaderData } from 'react-router';

import prisma from '#/libs/prisma.server';
import Badge from '#/components/admin/badge';
import Card from '#/components/admin/card';
import Input from '#/components/admin/form/input';
import Select from '#/components/admin/form/select';
import PageHeader from '#/components/admin/page-header';
import Table, { Th, Td, THead, TBody } from '#/components/admin/table';
import Button from '#/components/ui/button';

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
    <div>
      <PageHeader
        title="Sales channels"
        subtitle="Multi-storefront channels with per-domain routing and catalog overrides."
        className="mb-6"
      />

      <div className="space-y-6">
        <Card>
          <Form method="post" className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="intent" value="create-channel" />
            <Input name="name" placeholder="Channel name" className="w-auto" />
            <Input name="handle" placeholder="handle" className="w-auto" />
            <Input
              name="domain"
              placeholder="domain (optional)"
              className="w-auto"
            />
            <Input name="currency" defaultValue="USD" className="w-20" />
            <Input name="locale" defaultValue="en" className="w-16" />
            <Button type="submit" variant="primary">
              Create channel
            </Button>
          </Form>
        </Card>

        <div>
          <h2 className="text-text mb-3 text-lg font-semibold">
            Channels ({total})
          </h2>
          <Table>
            <THead>
              <tr>
                <Th>Name</Th>
                <Th>Handle</Th>
                <Th>Domain</Th>
                <Th>Currency</Th>
                <Th>Default</Th>
              </tr>
            </THead>
            <TBody>
              {channels.map((channel) => (
                <tr key={channel.id}>
                  <Td className="text-text">{channel.name}</Td>
                  <Td>{channel.handle}</Td>
                  <Td>{channel.domain ?? '—'}</Td>
                  <Td>{channel.currency}</Td>
                  <Td>
                    {channel.isDefault ? (
                      <Badge tone="success">Yes</Badge>
                    ) : (
                      <Form method="post">
                        <input
                          type="hidden"
                          name="intent"
                          value="set-default"
                        />
                        <input
                          type="hidden"
                          name="channelId"
                          value={channel.id}
                        />
                        <button
                          type="submit"
                          className="text-accent hover:underline"
                        >
                          Set default
                        </button>
                      </Form>
                    )}
                  </Td>
                </tr>
              ))}
            </TBody>
          </Table>
        </div>

        {nonDefaultChannels.length > 0 && products.length > 0 && (
          <Card>
            <h2 className="text-text text-lg font-semibold">
              Channel price override
            </h2>
            <Form method="post" className="mt-4 flex flex-wrap items-end gap-3">
              <input type="hidden" name="intent" value="set-price" />
              <Select name="channelId" className="w-auto">
                {nonDefaultChannels.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
              <Select name="variantId" className="w-auto">
                {products.flatMap((p) =>
                  p.variants.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.sku ?? v.id}
                    </option>
                  ))
                )}
              </Select>
              <Input
                name="priceCents"
                type="number"
                min="1"
                placeholder="Price (cents)"
                className="w-32"
              />
              <Input name="currency" defaultValue="USD" className="w-20" />
              <Button type="submit" variant="primary">
                Set override
              </Button>
            </Form>
          </Card>
        )}
      </div>
    </div>
  );
}
