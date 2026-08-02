import { useT } from '#/core/i18n';
import Badge from '#/components/admin/badge';

/** @typedef {'neutral'|'success'|'warn'|'danger'|'accent'} AdminBadgeTone */

/**
 * Tone map for return lifecycle statuses shown in admin surfaces.
 *
 * @type {Record<string, AdminBadgeTone>}
 */
export const RETURN_STATUS_TONES = {
  requested: 'warn',
  approved: 'accent',
  received: 'accent',
  refunded: 'success',
  exchanged: 'success',
  cancelled: 'neutral',
};

/**
 * Renders an admin badge for a return status.
 *
 * @param {Object} props
 * @param {string} props.status
 * @returns {React.ReactElement}
 */
export function ReturnStatusBadge({ status }) {
  const t = useT();
  const labelKey = `admin.returns.status.${status}`;
  const label = t(labelKey);
  return (
    <Badge tone={RETURN_STATUS_TONES[status] ?? 'neutral'}>
      {label === labelKey ? status : label}
    </Badge>
  );
}
