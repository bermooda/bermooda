// app/core/inventory/items/index.js
// Pure helpers for inventory increment/decrement payloads.

/**
 * Build variant inventory payloads from cart or order lines.
 *
 * @param {Array<{ variantId?: string|null, quantity: number }>} lines
 * @returns {Array<{ variantId: string, quantity: number }>}
 */
export function inventoryItemsFromLines(lines = []) {
  return lines
    .filter((line) => line.variantId != null)
    .map((line) => ({ variantId: line.variantId, quantity: line.quantity }));
}
