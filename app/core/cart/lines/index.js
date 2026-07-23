// app/core/cart/lines/index.js
// Client-safe cart line helpers (pure functions, no server deps).

/**
 * @param {{ priceCentsSnapshot: number, quantity: number }} line
 * @returns {number}
 */
export function cartLineTotal(line) {
  return line.priceCentsSnapshot * line.quantity;
}

/**
 * @param {Array<{ priceCentsSnapshot: number, quantity: number }>} lines
 * @returns {{ subtotalCents: number, totalQuantity: number }}
 */
export function summarizeCartLines(lines = []) {
  return lines.reduce(
    (acc, line) => {
      acc.subtotalCents += cartLineTotal(line);
      acc.totalQuantity += line.quantity;
      return acc;
    },
    { subtotalCents: 0, totalQuantity: 0 }
  );
}
