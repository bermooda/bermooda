import clsx from 'clsx';
import { useState } from 'react';
import { useFetcher } from 'react-router';

import { controlClasses } from '#/components/admin/form/input';
import {
  FieldLabel,
  SaveButton,
  SectionCard,
} from '#/components/admin/settings/shared';

const EMAIL_TEMPLATES = [
  {
    key: 'order-confirmation',
    name: 'Order Confirmation',
    description: 'Sent to customers after a successful order is placed.',
  },
  {
    key: 'password-reset-admin',
    name: 'Password Reset (Admin)',
    description: 'Sent to admin users when they request a password reset.',
  },
  {
    key: 'password-reset-customer',
    name: 'Password Reset (Customer)',
    description: 'Sent to customers when they request a password reset.',
  },
  {
    key: 'customer-welcome',
    name: 'Customer Welcome',
    description: 'Sent to new customers after registration.',
  },
  {
    key: 'abandoned-cart',
    name: 'Abandoned Cart',
    description: 'Sent to customers who left items in their cart.',
  },
];

/**
 * Email provider + templates settings tab.
 *
 * @param {Object} props
 * @param {object} props.data
 * @returns {React.ReactElement}
 */
export function EmailTemplatesTab({ data }) {
  const fetcher = useFetcher();
  const [provider, setProvider] = useState(data.emailProvider);

  return (
    <div className="space-y-6">
      <SectionCard title="Email Provider">
        <fetcher.Form method="post" className="space-y-6">
          <input type="hidden" name="intent" value="save-email-provider" />
          <input type="hidden" name="provider" value={provider} />

          <p className="text-text-muted text-sm">
            Choose the transport used for transactional and marketing email.
            Built-in options are Resend, SendGrid, and Amazon SES. Custom
            providers from enabled plugins also appear here. Configure API
            credentials via environment variables.
          </p>

          <div>
            <FieldLabel>Provider</FieldLabel>
            <select
              value={provider}
              onChange={(event) => setProvider(event.target.value)}
              className={clsx(controlClasses, 'mt-1 max-w-md')}
            >
              {(data.emailProviders ?? []).map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </select>
          </div>

          <SaveButton fetcher={fetcher} intent="save-email-provider" />
        </fetcher.Form>
      </SectionCard>

      <SectionCard title="Email Templates">
        <p className="text-text-muted mb-4 text-sm">
          These are the available email templates. Preview links will be active
          in a future update.
        </p>
        <div className="space-y-3">
          {EMAIL_TEMPLATES.map((tpl) => (
            <div
              key={tpl.key}
              className="border-border flex items-start justify-between rounded-lg border px-4 py-3"
            >
              <div>
                <p className="text-text text-sm font-medium">{tpl.name}</p>
                <p className="text-text-muted mt-0.5 text-xs">
                  {tpl.description}
                </p>
              </div>
              <span
                className="text-text-muted ml-4 shrink-0 text-xs italic"
                title="Preview not yet available"
              >
                Preview coming soon
              </span>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
