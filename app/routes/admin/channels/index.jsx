// app/routes/admin/channels/index.jsx

import { PlusIcon, QueueListIcon } from '@heroicons/react/24/outline';
import { Form, Link, useLoaderData, useNavigate } from 'react-router';

import {
  loadChannelAdminIndexData,
  parseChannelAdminAction,
  setChannelPriceOverride,
  updateChannel,
} from '#/core/channels/index.server';
import { useT } from '#/core/i18n';
import Badge from '#/components/admin/badge';
import Card from '#/components/admin/card';
import EmptyState from '#/components/admin/empty-state';
import Input from '#/components/admin/form/input';
import Select from '#/components/admin/form/select';
import PageHeader from '#/components/admin/page-header';
import Table, { Th, Td, THead, TBody, Tr } from '#/components/admin/table';
import Toolbar, { ToolbarGroup } from '#/components/admin/toolbar';
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
  const navigate = useNavigate();
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

      <Toolbar className="border-border mb-4 rounded-xl border shadow-xs sm:px-4">
        <ToolbarGroup>
          <span className="text-text-muted text-sm">
            {total === 1
              ? t('admin.channels.index.resultsOne', { count: total })
              : t('admin.channels.index.results', { count: total })}
          </span>
        </ToolbarGroup>
      </Toolbar>

      {channels.length === 0 ? (
        <EmptyState
          icon={QueueListIcon}
          title={t('admin.channels.index.emptyTitle')}
          description={t('admin.channels.index.emptyDescription')}
          action={
            <Link
              to="/admin/channels/new"
              className="bg-accent text-accent-fg hover:bg-accent-hover inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold shadow-sm transition"
            >
              <PlusIcon className="h-4 w-4" />
              {t('admin.channels.index.newButton')}
            </Link>
          }
        />
      ) : (
        <Table variant="sticky" className="mt-2">
          <THead sticky>
            <tr>
              <Th sticky className="py-3.5 pr-3 pl-1 sm:pl-0">
                {t('admin.channels.index.col.name')}
              </Th>
              <Th sticky className="hidden px-3 py-3.5 sm:table-cell">
                {t('admin.channels.index.col.domain')}
              </Th>
              <Th sticky className="hidden px-3 py-3.5 md:table-cell">
                {t('admin.channels.index.col.currency')}
              </Th>
              <Th sticky className="px-3 py-3.5">
                {t('admin.channels.index.col.default')}
              </Th>
              <Th sticky className="py-3.5 pr-1 pl-3 sm:pr-0">
                <span className="sr-only">
                  {t('admin.channels.index.col.edit')}
                </span>
              </Th>
            </tr>
          </THead>
          <TBody sticky>
            {channels.map((channel) => (
              <Tr
                key={channel.id}
                role="link"
                tabIndex={0}
                className="group cursor-pointer"
                onClick={() => navigate(`/admin/channels/${channel.id}`)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    navigate(`/admin/channels/${channel.id}`);
                  }
                }}
              >
                <Td
                  sticky
                  className="text-text py-4 pr-3 pl-1 font-medium whitespace-normal sm:pl-0"
                >
                  <span className="block min-w-0">
                    <span className="group-hover:text-accent block truncate font-medium transition-colors">
                      {channel.name}
                    </span>
                    <span className="text-text-muted mt-0.5 block truncate font-mono text-xs font-normal">
                      {channel.handle}
                    </span>
                  </span>
                </Td>
                <Td
                  sticky
                  className="hidden px-3 py-4 whitespace-normal sm:table-cell"
                >
                  {channel.domain ?? (
                    <span className="text-text-muted text-xs">—</span>
                  )}
                </Td>
                <Td
                  sticky
                  className="hidden px-3 py-4 font-mono tabular-nums md:table-cell"
                >
                  {channel.currency}
                </Td>
                <Td sticky className="px-3 py-4">
                  {channel.isDefault ? (
                    <Badge tone="success">
                      {t('admin.channels.index.yes')}
                    </Badge>
                  ) : (
                    <Form
                      method="post"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <input type="hidden" name="intent" value="set-default" />
                      <input
                        type="hidden"
                        name="channelId"
                        value={channel.id}
                      />
                      <button
                        type="submit"
                        className="text-accent hover:text-accent-hover text-sm font-medium"
                      >
                        {t('admin.channels.index.setDefault')}
                      </button>
                    </Form>
                  )}
                </Td>
                <Td
                  sticky
                  className="py-4 pr-1 pl-3 text-right text-sm font-medium sm:pr-0"
                >
                  <Link
                    to={`/admin/channels/${channel.id}`}
                    className="text-accent hover:text-accent-hover"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {t('admin.channels.index.edit')}
                    <span className="sr-only">, {channel.name}</span>
                  </Link>
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      )}

      {nonDefaultChannels.length > 0 && products.length > 0 && (
        <Card className="mt-8">
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
  );
}
