import { CheckIcon, ClipboardDocumentIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { Form, Link } from 'react-router';

import { API_KEY_SCOPES } from '#/core/api-keys/scopes';
import { useT } from '#/core/i18n';
import Breadcrumbs from '#/components/admin/breadcrumbs';
import FormSection from '#/components/admin/form-section';
import Field from '#/components/admin/form/field';
import Input from '#/components/admin/form/input';
import PageHeader from '#/components/admin/page-header';
import { ErrorAlert, SuccessAlert } from '#/components/ui/alert';
import { ButtonSubmit } from '#/components/ui/button';

const CHECKBOX_CLASS =
  'border-border text-accent focus:ring-accent bg-surface h-4 w-4 rounded';

/**
 * @param {{ value: string }} props
 */
function CopyButton({ value }) {
  const t = useT();
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="text-success hover:text-success/80 ml-2 shrink-0 rounded p-1"
      title={t('admin.apiSettings.keysNew.copyTitle')}
    >
      {copied ? (
        <CheckIcon className="h-4 w-4" />
      ) : (
        <ClipboardDocumentIcon className="h-4 w-4" />
      )}
    </button>
  );
}

/**
 * Admin API key create editor (FormSection detail pattern).
 *
 * @param {Object} props
 * @param {{ error?: string, ok?: boolean, key?: string }} [props.actionData]
 * @param {boolean} props.isSaving
 * @returns {React.ReactElement}
 */
export default function ApiKeyEditor({ actionData, isSaving }) {
  const t = useT();
  const [selectedScopes, setSelectedScopes] = useState(['admin']);
  const createdKey = actionData?.ok ? actionData.key : null;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              {
                label: t('admin.apiSettings.keysNew.breadcrumbApi'),
                href: '/admin/api-settings',
              },
              { label: t('admin.apiSettings.keysNew.breadcrumb') },
            ]}
          />
        }
        title={t('admin.apiSettings.keysNew.title')}
        subtitle={t('admin.apiSettings.keysNew.subtitle')}
      />

      {createdKey ? (
        <div className="bg-success/10 border-success/30 mb-6 rounded-md border p-4">
          <SuccessAlert message={t('admin.apiSettings.keysNew.createdAlert')} />
          <div className="text-success mt-2 flex items-center font-mono text-sm">
            <code className="break-all">{createdKey}</code>
            <CopyButton value={createdKey} />
          </div>
        </div>
      ) : null}

      <ErrorAlert message={actionData?.error} />

      <Form method="post" id="api-key-editor-form">
        <div className="space-y-12">
          <FormSection
            title={t('admin.apiSettings.keysNew.cardTitle')}
            description={t('admin.apiSettings.keysNew.cardDescription')}
            last
          >
            <div className="grid max-w-2xl grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
              <Field
                className="col-span-full"
                label={t('admin.apiSettings.keysNew.label')}
                htmlFor="api-key-label"
              >
                <Input
                  id="api-key-label"
                  name="label"
                  required
                  placeholder={t('admin.apiSettings.keysNew.labelPlaceholder')}
                  disabled={Boolean(createdKey)}
                />
              </Field>
              <Field
                className="col-span-full"
                label={t('admin.apiSettings.keysNew.scopes')}
              >
                <div className="flex flex-wrap gap-4">
                  {API_KEY_SCOPES.map((scope) => (
                    <label
                      key={scope}
                      className="text-text flex items-center gap-1.5 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={selectedScopes.includes(scope)}
                        disabled={Boolean(createdKey)}
                        onChange={() =>
                          setSelectedScopes((prev) =>
                            prev.includes(scope)
                              ? prev.filter((s) => s !== scope)
                              : [...prev, scope]
                          )
                        }
                        className={CHECKBOX_CLASS}
                      />
                      <span className="capitalize">{scope}</span>
                    </label>
                  ))}
                </div>
                {selectedScopes.map((s) => (
                  <input key={s} type="hidden" name="scopes" value={s} />
                ))}
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
            {createdKey
              ? t('admin.apiSettings.keysNew.back')
              : t('common.cancel')}
          </Link>
          {!createdKey ? (
            <ButtonSubmit form="api-key-editor-form" disabled={isSaving}>
              {isSaving
                ? t('admin.apiSettings.keysNew.creating')
                : t('admin.apiSettings.keysNew.createButton')}
            </ButtonSubmit>
          ) : null}
        </div>
      </div>
    </div>
  );
}
