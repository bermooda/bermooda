// Client-safe helpers for order address snapshots.

/**
 * @param {{ shippingAddressSnapshot?: string | object | null }} order
 */
export function parseShippingAddressSnapshot(order) {
  const snapshot = order?.shippingAddressSnapshot;
  if (typeof snapshot === 'string') {
    try {
      return JSON.parse(snapshot);
    } catch {
      return {};
    }
  }
  return snapshot ?? {};
}
