// GET /admin/shipments/:id/documents — download packing slip PDF

import { authenticate } from '#/libs/auth/admin.server';
import {
  buildDocumentPdfResponse,
  buildPackingSlipFilename,
  generatePackingSlipPdf,
  loadShipmentForPackingSlip,
  mapDocumentErrorResponse,
} from '#/core/documents/index.server';

export async function loader({ params, request }) {
  await authenticate(request);

  try {
    const shipment = await loadShipmentForPackingSlip(params.id);
    const pdf = await generatePackingSlipPdf(params.id);
    return buildDocumentPdfResponse(pdf, buildPackingSlipFilename(shipment));
  } catch (err) {
    return mapDocumentErrorResponse(err);
  }
}
