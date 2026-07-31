import { SectionCard } from '#/components/admin/settings/shared';

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
    key: 'staff-invite',
    name: 'Staff Invite',
    description:
      'Sent when an admin invites a new staff member to create their password.',
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
 * Email templates preview tab.
 *
 * @returns {React.ReactElement}
 */
export function EmailTemplatesTab() {
  return (
    <SectionCard title="Email Templates">
      <p className="text-text-muted mb-4 text-sm">
        Templates are sent through the active email provider plugin. Choose
        Resend, SendGrid, or Amazon SES under{' '}
        <a href="/admin/plugins" className="text-accent underline">
          Admin → Plugins
        </a>
        . Preview links will be active in a future update.
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
  );
}
