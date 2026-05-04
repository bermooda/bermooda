// app/core/index.js
// Public surface for the core module. Re-export everything consumers need;
// internals (domain modules, storage, etc.) remain unexported.

// -- Hooks ------------------------------------------------------------------

/**
 * Returns current shop context from Settings + i18n + currency services.
 * Stub: returns hard-coded defaults until P3-6/P3-7/P3-8 are wired in.
 * @returns {{ currency: string, locale: string }}
 */
export function useShop() {
  return { currency: 'USD', locale: 'en' };
}

/**
 * Returns a translation function for the active locale.
 * Stub: returns pass-through until P3-7 i18n resolver is wired in.
 * @returns {(key: string, params?: Record<string, unknown>) => string}
 */
export function useT() {
  return (key) => key;
}

// -- Utilities --------------------------------------------------------------

export function formatPrice(cents, currency = 'USD', locale = 'en') {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(
    cents / 100
  );
}

// -- Components -------------------------------------------------------------

// Slot intentionally returns children as-is (no JSX) so this file stays .js.
export function Slot({ name: _name, children }) {
  return children ?? null;
}

// -- Selectors --------------------------------------------------------------

export const selectors = {
  cartLineCount: (cart) => cart?.lines?.length ?? 0,
  cartTotal: (cart) =>
    cart?.lines?.reduce(
      (sum, l) => sum + l.priceCentsSnapshot * l.quantity,
      0
    ) ?? 0,
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
