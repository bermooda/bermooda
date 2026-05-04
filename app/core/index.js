// app/core/index.js
// Public surface for the core module. Re-export everything consumers need;
// internals (domain modules, storage, etc.) remain unexported.

// -- Hooks ------------------------------------------------------------------

export function useShop() {
  return { currency: 'USD', locale: 'en' };
}

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
  product: (p) => ({ id: p.id, title: p.title, slug: p.slug ?? null }),
  variant: (v) => ({
    id: v.id,
    title: v.title,
    sku: v.sku ?? null,
    inventoryQuantity: v.inventoryQuantity,
  }),
  order: (o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    totalCents: o.totalCents,
  }),
};
