import { Form, Link } from 'react-router';

import { useT } from '#/core/i18n';
import Badge from '#/components/admin/badge';
import Breadcrumbs from '#/components/admin/breadcrumbs';
import FormSection from '#/components/admin/form-section';
import Field from '#/components/admin/form/field';
import Input from '#/components/admin/form/input';
import PageHeader from '#/components/admin/page-header';
import { ErrorAlert } from '#/components/ui/alert';
import { ButtonSubmit } from '#/components/ui/button';

/**
 * Shared admin channel editor for create and edit routes.
 *
 * @param {Object} props
 * @param {'create'|'edit'} [props.mode]
 * @param {{
 *   name?: string,
 *   handle?: string,
 *   domain?: string | null,
 *   currency?: string,
 *   locale?: string,
 *   active?: boolean,
 *   isDefault?: boolean,
 * }} [props.channel]
 * @param {{ error?: string }} [props.actionData]
 * @param {boolean} props.isSaving
 * @returns {React.ReactElement}
 */
export default function ChannelEditor({
  mode = 'edit',
  channel = {},
  actionData,
  isSaving,
}) {
  const t = useT();
  const isCreate = mode === 'create';

  const displayTitle = isCreate
    ? t('admin.channels.new.title')
    : channel.name || t('admin.channels.new.title');

  const subtitle = isCreate ? (
    t('admin.channels.new.subtitle')
  ) : (
    <span className="inline-flex flex-wrap items-center gap-2">
      {channel.isDefault ? (
        <Badge tone="success">{t('admin.channels.edit.defaultBadge')}</Badge>
      ) : null}
      <span>{t('admin.channels.edit.subtitle')}</span>
    </span>
  );

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              {
                label: isCreate
                  ? t('admin.channels.new.breadcrumb')
                  : t('admin.channels.edit.breadcrumb'),
                href: '/admin/channels',
              },
              { label: displayTitle },
            ]}
          />
        }
        title={displayTitle}
        subtitle={subtitle}
      />

      <ErrorAlert message={actionData?.error} />

      <Form method="post" id="channel-editor-form">
        <div className="space-y-12">
          <FormSection
            title={
              isCreate
                ? t('admin.channels.new.cardTitle')
                : t('admin.channels.edit.cardTitle')
            }
            description={
              isCreate
                ? t('admin.channels.new.cardDescription')
                : t('admin.channels.edit.cardDescription')
            }
            last
          >
            <div className="grid max-w-2xl grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
              <Field
                className="sm:col-span-3"
                label={
                  isCreate
                    ? t('admin.channels.new.name')
                    : t('admin.channels.edit.name')
                }
                htmlFor="channel-name"
              >
                <Input
                  id="channel-name"
                  name="name"
                  required
                  defaultValue={channel.name ?? ''}
                  placeholder={
                    isCreate
                      ? t('admin.channels.new.namePlaceholder')
                      : undefined
                  }
                />
              </Field>
              <Field
                className="sm:col-span-3"
                label={
                  isCreate
                    ? t('admin.channels.new.handle')
                    : t('admin.channels.edit.handle')
                }
                htmlFor="channel-handle"
              >
                <Input
                  id="channel-handle"
                  name="handle"
                  required
                  defaultValue={channel.handle ?? ''}
                  placeholder={
                    isCreate
                      ? t('admin.channels.new.handlePlaceholder')
                      : undefined
                  }
                />
              </Field>
              <Field
                className="sm:col-span-3"
                label={
                  isCreate
                    ? t('admin.channels.new.domain')
                    : t('admin.channels.edit.domain')
                }
                htmlFor="channel-domain"
              >
                <Input
                  id="channel-domain"
                  name="domain"
                  defaultValue={channel.domain ?? ''}
                  placeholder={
                    isCreate
                      ? t('admin.channels.new.domainPlaceholder')
                      : t('admin.channels.edit.domainPlaceholder')
                  }
                />
              </Field>
              <Field
                className="sm:col-span-3"
                label={
                  isCreate
                    ? t('admin.channels.new.currency')
                    : t('admin.channels.edit.currency')
                }
                htmlFor="channel-currency"
              >
                <Input
                  id="channel-currency"
                  name="currency"
                  defaultValue={channel.currency ?? 'USD'}
                  maxLength={3}
                  className="uppercase"
                />
              </Field>
              <Field
                className="sm:col-span-3"
                label={
                  isCreate
                    ? t('admin.channels.new.locale')
                    : t('admin.channels.edit.locale')
                }
                htmlFor="channel-locale"
              >
                <Input
                  id="channel-locale"
                  name="locale"
                  defaultValue={channel.locale ?? 'en'}
                />
              </Field>
              {!isCreate ? (
                <div className="col-span-full">
                  <label className="text-text flex cursor-pointer items-center gap-3 text-sm/6">
                    <input
                      type="checkbox"
                      name="active"
                      defaultChecked={Boolean(channel.active)}
                      className="border-border text-accent focus:ring-accent bg-surface h-4 w-4 rounded"
                    />
                    {t('admin.channels.edit.active')}
                  </label>
                </div>
              ) : null}
            </div>
          </FormSection>
        </div>
      </Form>

      <div className="mt-6 mb-6 flex items-center justify-between gap-x-6">
        <span />
        <div className="flex items-center gap-x-6">
          <Link
            to="/admin/channels"
            className="text-text text-sm/6 font-semibold transition-colors hover:opacity-80"
          >
            {t('common.cancel')}
          </Link>
          <ButtonSubmit form="channel-editor-form" disabled={isSaving}>
            {isSaving
              ? isCreate
                ? t('admin.channels.new.creating')
                : t('admin.channels.edit.saving')
              : isCreate
                ? t('admin.channels.new.createButton')
                : t('admin.channels.edit.saveButton')}
          </ButtonSubmit>
        </div>
      </div>
    </div>
  );
}
