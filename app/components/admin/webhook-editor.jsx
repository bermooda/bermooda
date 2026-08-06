import { useState } from 'react';
import { Form, Link } from 'react-router';

import { useT } from '#/core/i18n';
import Breadcrumbs from '#/components/admin/breadcrumbs';
import FormSection from '#/components/admin/form-section';
import Field from '#/components/admin/form/field';
import Input from '#/components/admin/form/input';
import PageHeader from '#/components/admin/page-header';
import { ErrorAlert } from '#/components/ui/alert';
import { ButtonSubmit } from '#/components/ui/button';

const CHECKBOX_CLASS =
  'border-border text-accent focus:ring-accent bg-surface h-4 w-4 rounded';

/**
 * Admin webhook subscription create editor (FormSection detail pattern).
 *
 * @param {Object} props
 * @param {string[]} props.supportedEvents
 * @param {{ error?: string }} [props.actionData]
 * @param {boolean} props.isSaving
 * @returns {React.ReactElement}
 */
export default function WebhookEditor({
  supportedEvents,
  actionData,
  isSaving,
}) {
  const t = useT();
  const [selectedEvents, setSelectedEvents] = useState(
    /** @type {string[]} */ ([])
  );

  /**
   * @param {string} event
   */
  function toggleEvent(event) {
    setSelectedEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              {
                label: t('admin.apiSettings.webhooksNew.breadcrumbApi'),
                href: '/admin/api-settings',
              },
              { label: t('admin.apiSettings.webhooksNew.breadcrumb') },
            ]}
          />
        }
        title={t('admin.apiSettings.webhooksNew.title')}
        subtitle={t('admin.apiSettings.webhooksNew.subtitle')}
      />

      <ErrorAlert message={actionData?.error} />

      <Form method="post" id="webhook-editor-form">
        {selectedEvents.map((e) => (
          <input key={e} type="hidden" name="events" value={e} />
        ))}

        <div className="space-y-12">
          <FormSection
            title={t('admin.apiSettings.webhooksNew.cardTitle')}
            description={t('admin.apiSettings.webhooksNew.cardDescription')}
            last
          >
            <div className="grid max-w-2xl grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
              <Field
                className="col-span-full"
                label={t('admin.apiSettings.webhooksNew.url')}
                htmlFor="webhook-url"
              >
                <Input
                  id="webhook-url"
                  name="url"
                  type="url"
                  required
                  placeholder={t(
                    'admin.apiSettings.webhooksNew.urlPlaceholder'
                  )}
                />
              </Field>
              <Field
                className="col-span-full"
                label={t('admin.apiSettings.webhooksNew.secret')}
                htmlFor="webhook-secret"
                hint={t('admin.apiSettings.webhooksNew.secretHelp')}
              >
                <Input
                  id="webhook-secret"
                  name="secret"
                  required
                  placeholder={t(
                    'admin.apiSettings.webhooksNew.secretPlaceholder'
                  )}
                />
              </Field>
              <Field
                className="col-span-full"
                label={t('admin.apiSettings.webhooksNew.label')}
                htmlFor="webhook-label"
              >
                <Input
                  id="webhook-label"
                  name="label"
                  placeholder={t(
                    'admin.apiSettings.webhooksNew.labelPlaceholder'
                  )}
                />
              </Field>
              <Field
                className="col-span-full"
                label={t('admin.apiSettings.webhooksNew.events')}
              >
                <div className="grid gap-2 sm:grid-cols-2">
                  {supportedEvents.map((event) => (
                    <label
                      key={event}
                      className="text-text flex items-center gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={selectedEvents.includes(event)}
                        onChange={() => toggleEvent(event)}
                        className={CHECKBOX_CLASS}
                      />
                      <code className="text-xs">{event}</code>
                    </label>
                  ))}
                </div>
              </Field>
            </div>
          </FormSection>
        </div>
      </Form>

      <div className="mt-6 mb-6 flex items-center justify-between gap-x-6">
        <span />
        <div className="flex items-center gap-x-6">
          <Link
            to="/admin/api-settings"
            className="text-text text-sm/6 font-semibold transition-colors hover:opacity-80"
          >
            {t('common.cancel')}
          </Link>
          <ButtonSubmit form="webhook-editor-form" disabled={isSaving}>
            {isSaving
              ? t('admin.apiSettings.webhooksNew.creating')
              : t('admin.apiSettings.webhooksNew.createButton')}
          </ButtonSubmit>
        </div>
      </div>
    </div>
  );
}
