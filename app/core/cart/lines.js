// app/core/cart/lines.js
// Client-safe cart line helpers (pure functions, no server deps).

/**
 * @param {Array<{ priceCentsSnapshot: number, quantity: number }>} lines
 * @returns {{ subtotalCents: number, totalQuantity: number }}
 */
export function summarizeCartLines(lines = []) {
  return lines.reduce(
    (acc, line) => {
      acc.subtotalCents += line.priceCentsSnapshot * line.quantity;
      acc.totalQuantity += line.quantity;
      return acc;
    },
    { subtotalCents: 0, totalQuantity: 0 }
  );
}
