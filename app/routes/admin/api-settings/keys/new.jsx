import { CheckIcon, ClipboardDocumentIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { Form, Link, useActionData, useNavigation } from 'react-router';

import { authenticate } from '#/libs/auth/admin/index.server';
import {
  createApiKey,
  parseCreateApiKeyFormData,
} from '#/core/api-keys/index.server';
import { API_KEY_SCOPES } from '#/core/api-keys/scopes';
import ActionBar from '#/components/admin/action-bar';
import Breadcrumbs from '#/components/admin/breadcrumbs';
import Card, { CardHeader } from '#/components/admin/card';
import Field from '#/components/admin/form/field';
import Input from '#/components/admin/form/input';
import PageHeader from '#/components/admin/page-header';
import { ErrorAlert, SuccessAlert } from '#/components/ui/alert';
import { ButtonSubmit } from '#/components/ui/button';

const CHECKBOX_CLASS =
  'border-border text-accent focus:ring-accent bg-surface h-4 w-4 rounded';

function CopyButton({ value }) {
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
      title="Copy to clipboard"
    >
      {copied ? (
        <CheckIcon className="h-4 w-4" />
      ) : (
        <ClipboardDocumentIcon className="h-4 w-4" />
      )}
    </button>
  );
}

export async function action({ request }) {
  await authenticate(request);
  const formData = await request.formData();

  try {
    const input = parseCreateApiKeyFormData(formData);
    const { key, record } = await createApiKey(input);
    return { ok: true, key, record };
  } catch (err) {
    return { error: err.message };
  }
}

export default function AdminNewApiKeyRoute() {
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSaving = navigation.state === 'submitting';
  const [selectedScopes, setSelectedScopes] = useState(['admin']);
  const createdKey = actionData?.ok ? actionData.key : null;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'API', href: '/admin/api-settings' },
              { label: 'New API key' },
            ]}
          />
        }
        title="New API key"
        subtitle="API keys authenticate requests to /api/admin/v1/* endpoints."
      />

      {createdKey && (
        <div className="bg-success/10 mb-6 rounded-lg p-4">
          <SuccessAlert message="Key created — copy it now, it won't be shown again." />
          <div className="text-success mt-2 flex items-center font-mono text-sm">
            <code className="break-all">{createdKey}</code>
            <CopyButton value={createdKey} />
          </div>
        </div>
      )}

      <ErrorAlert message={actionData?.error} />

      <Form method="post" className="space-y-6">
        <Card>
          <CardHeader
            title="Key details"
            description="Store keys securely. They are shown only once after creation."
          />
          <div className="space-y-4">
            <Field label="Label *" htmlFor="api-key-label">
              <Input
                id="api-key-label"
                name="label"
                required
                placeholder="My integration"
              />
            </Field>
            <Field label="Scopes">
              <div className="flex gap-4">
                {API_KEY_SCOPES.map((scope) => (
                  <label
                    key={scope}
                    className="text-text flex items-center gap-1.5 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={selectedScopes.includes(scope)}
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
        </Card>

        <ActionBar>
          <span />
          <div className="flex items-center gap-3">
            <Link
              to="/admin/api-settings"
              className="text-text-muted hover:text-text text-sm transition-colors"
            >
              {createdKey ? 'Back to API settings' : 'Cancel'}
            </Link>
            {!createdKey && (
              <ButtonSubmit disabled={isSaving}>
                {isSaving ? 'Creating…' : 'Create API key'}
              </ButtonSubmit>
            )}
          </div>
        </ActionBar>
      </Form>
    </div>
  );
}
