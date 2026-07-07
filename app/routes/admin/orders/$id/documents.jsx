// GET /admin/orders/:id/documents — download invoice PDF

import { authenticate } from '#/libs/auth/admin.server';
import {
  buildDocumentPdfResponse,
  buildInvoiceFilename,
  generateInvoicePdf,
  loadOrderForInvoice,
  mapDocumentErrorResponse,
} from '#/core/documents/index.server';

export async function loader({ params, request }) {
  await authenticate(request);

  try {
    const order = await loadOrderForInvoice(params.id);
    const pdf = await generateInvoicePdf(params.id);
    return buildDocumentPdfResponse(pdf, buildInvoiceFilename(order));
  } catch (err) {
    return mapDocumentErrorResponse(err);
  }
}
