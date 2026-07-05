// app/core/index.js
// Public client-safe surface for the core module. Re-export everything
// consumers need; server-only internals live in index.server.js.

// -- Hooks ------------------------------------------------------------------

/**
 * Returns current shop context from Settings + i18n + currency services.
 * Stub: returns hard-coded defaults until the storefront layout wires in
 * the real values from the i18n/currency loaders.
 * @returns {{ currency: string, locale: string }}
 */
export function useShop() {
  return { currency: 'USD', locale: 'en' };
}

export { useT, translate } from '#/core/i18n/index';

// -- Utilities --------------------------------------------------------------

// formatPrice is a pure Intl helper — client-safe.
export { formatPrice } from '#/core/currency/format';

export { summarizeCartLines } from '#/core/cart/lines';

// -- Components -------------------------------------------------------------

// Slot intentionally returns children as-is (no JSX) so this file stays .js.
export function Slot({ name: _name, children }) {
  return children ?? null;
}

// -- Selectors --------------------------------------------------------------

import { summarizeCartLines } from '#/core/cart/lines';

export const selectors = {
  cartLineCount: (cart) => cart?.lines?.length ?? 0,
  cartTotal: (cart) => summarizeCartLines(cart?.lines).subtotalCents,
};

// -- DTOs -------------------------------------------------------------------

export const dto = {
  /** @param {{ id: string, title: string, slug?: { slug: string } | null }} p */
  product: (p) => ({ id: p.id, title: p.title, slug: p.slug ?? null }),
  /** @param {{ id: string, title: string, sku?: string | null, inventoryQuantity: number }} v */
  variant: (v) => ({
    id: v.id,
    title: v.title,
    sku: v.sku ?? null,
    inventoryQuantity: v.inventoryQuantity,
  }),
  /** @param {{ id: string, orderNumber: string, status: string, totalCents: number }} o */
  order: (o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    totalCents: o.totalCents,
  }),
};
