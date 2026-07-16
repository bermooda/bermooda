import Badge from '#/components/admin/badge';

/** @typedef {'neutral'|'success'|'warn'|'danger'|'accent'} AdminBadgeTone */

/**
 * Tone map for order lifecycle statuses shown in admin surfaces.
 *
 * @type {Record<string, AdminBadgeTone>}
 */
export const ORDER_STATUS_TONES = {
  pending: 'warn',
  pending_payment: 'warn',
  paid: 'accent',
  fulfilled: 'success',
  cancelled: 'danger',
  refunded: 'neutral',
};

/**
 * Renders an admin badge for an order status.
 *
 * @param {Object} props
 * @param {string} props.status
 * @returns {React.ReactElement}
 */
export function OrderStatusBadge({ status }) {
  return <Badge tone={ORDER_STATUS_TONES[status] ?? 'neutral'}>{status}</Badge>;
}
