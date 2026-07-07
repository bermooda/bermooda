// GET /api/admin/v1/orders/:id/documents/invoice — download invoice PDF
// Requires admin-scoped API key.

import {
  buildDocumentPdfResponse,
  buildInvoiceFilename,
  generateInvoicePdf,
  loadOrderForInvoice,
  mapDocumentErrorResponse,
} from '#/core/documents/index.server';

export async function loader({ params }) {
  try {
    const order = await loadOrderForInvoice(params.id);
    const pdf = await generateInvoicePdf(params.id);
    return buildDocumentPdfResponse(pdf, buildInvoiceFilename(order));
  } catch (err) {
    return mapDocumentErrorResponse(err);
  }
}
