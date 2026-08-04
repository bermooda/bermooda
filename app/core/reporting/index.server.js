// app/core/reporting/index.server.js
// Barrel re-exports for the reporting domain (backward-compatible public API).

export {
  PAID_ORDER_STATUSES,
  DEFAULT_REPORT_LIMIT,
  MAX_REPORT_LIMIT,
  parseDateRange,
  buildCreatedAtFilter,
  buildPaidOrderWhere,
  parseReportParams,
} from '#/core/reporting/shared.server';

export {
  getSalesOverTime,
  getSalesByProduct,
  getSalesByCategory,
} from '#/core/reporting/sales.server';

export {
  getOverviewMetrics,
  loadAdminDashboardData,
  getCustomerMetrics,
  getOpsMetrics,
  getDashboardReport,
} from '#/core/reporting/kpis.server';

export {
  LOW_STOCK_THRESHOLD,
  getInventoryMetrics,
} from '#/core/reporting/inventory.server';

export { getExportMetrics } from '#/core/reporting/export-metrics.server';
