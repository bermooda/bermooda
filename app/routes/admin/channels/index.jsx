// app/routes/admin/channels/index.jsx

import { PlusIcon } from '@heroicons/react/24/outline';
import { Form, Link, useLoaderData } from 'react-router';

import {
  loadChannelAdminIndexData,
  parseChannelAdminAction,
  setChannelPriceOverride,
  updateChannel,
} from '#/core/channels/index.server';
import { useT } from '#/core/i18n';
import Badge from '#/components/admin/badge';
import Card from '#/components/admin/card';
import Input from '#/components/admin/form/input';
import Select from '#/components/admin/form/select';
import PageHeader from '#/components/admin/page-header';
import Table, { Th, Td, THead, TBody } from '#/components/admin/table';
import Button from '#/components/ui/button';

export async function loader() {
  return loadChannelAdminIndexData({ limit: 100 });
}

export async function action({ request }) {
  const formData = await request.formData();

  try {
    const parsed = await parseChannelAdminAction(formData);

    if (parsed.intent === 'set-default') {
      await updateChannel(parsed.channelId, { isDefault: true });
      return { ok: true };
    }

    if (parsed.intent === 'set-price') {
      await setChannelPriceOverride(parsed);
      return { ok: true };
    }
  } catch (err) {
    return { ok: false, error: err.message };
  }

  return { ok: false, error: 'Unknown action.' };
}

export default function AdminChannelsRoute() {
  const t = useT();
  const { channels, total, products } = useLoaderData();
  const nonDefaultChannels = channels.filter((c) => !c.isDefault);

  return (
    <div>
      <PageHeader
        title={t('admin.channels.index.title')}
        subtitle={t('admin.channels.index.subtitle')}
        actions={
          <Link
            to="/admin/channels/new"
            className="bg-accent text-accent-fg hover:bg-accent-hover focus-visible:outline-accent inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-semibold shadow-sm transition focus-visible:outline focus-visible:outline-offset-2"
          >
            <PlusIcon className="h-4 w-4" />
            {t('admin.channels.index.newButton')}
          </Link>
        }
      />

      <div className="space-y-6">
        <div>
          <h2 className="text-text mb-3 text-lg font-semibold">
            {t('admin.channels.index.heading', { total })}
          </h2>
          <Table>
            <THead>
              <tr>
                <Th>{t('admin.channels.index.col.name')}</Th>
                <Th>{t('admin.channels.index.col.handle')}</Th>
                <Th>{t('admin.channels.index.col.domain')}</Th>
                <Th>{t('admin.channels.index.col.currency')}</Th>
                <Th>{t('admin.channels.index.col.default')}</Th>
              </tr>
            </THead>
            <TBody>
              {channels.map((channel) => (
                <tr key={channel.id}>
                  <Td className="text-text">
                    <Link
                      to={`/admin/channels/${channel.id}`}
                      className="hover:text-accent font-medium"
                    >
                      {channel.name}
                    </Link>
                  </Td>
                  <Td>{channel.handle}</Td>
                  <Td>{channel.domain ?? '—'}</Td>
                  <Td>{channel.currency}</Td>
                  <Td>
                    {channel.isDefault ? (
                      <Badge tone="success">
                        {t('admin.channels.index.yes')}
                      </Badge>
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
                          {t('admin.channels.index.setDefault')}
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
              {t('admin.channels.index.priceOverride')}
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
                placeholder={t('admin.channels.index.pricePlaceholder')}
                className="w-32"
              />
              <Input name="currency" defaultValue="USD" className="w-20" />
              <Button type="submit" variant="primary">
                {t('admin.channels.index.setOverride')}
              </Button>
            </Form>
          </Card>
        )}
      </div>
    </div>
  );
}
