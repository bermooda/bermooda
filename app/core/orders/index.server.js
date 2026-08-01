// app/core/orders/index.server.js
// Barrel re-exports for the orders domain (backward-compatible public API).

export { placeOrder, attachPaymentIntent } from '#/core/orders/place.server';

export {
  serializeOrderAdminDetail,
  getOrder,
  getOrderByOrderNumber,
  listOrders,
  loadOrdersAdminIndexData,
  loadOrderAdminDetailData,
  updateOrderStatus,
  transitionOrderStatus,
  updateOrderNotes,
  cancelOrder,
} from '#/core/orders/admin.server';

export {
  deriveFulfillmentStatus,
  syncOrderFulfillmentStatus,
  addShipment,
  markShipped,
  markDelivered,
} from '#/core/orders/fulfillment.server';

export { createRefund } from '#/core/orders/refunds.server';

export { registerPaymentEventHandlers } from '#/core/orders/payment-handlers.server';
