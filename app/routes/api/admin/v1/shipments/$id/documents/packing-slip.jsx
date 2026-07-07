// GET /api/admin/v1/shipments/:id/documents/packing-slip — download packing slip PDF
// Requires admin-scoped API key.

import { generatePackingSlipPdf } from '#/core/documents/index.server';

export async function loader({ params }) {
  try {
    const pdf = await generatePackingSlipPdf(params.id);
    return new Response(pdf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="packing-slip-${params.id}.pdf"`,
      },
    });
  } catch (err) {
    return Response.json(
      { error: err.message, code: err.code },
      { status: err.message === 'SHIPMENT_NOT_FOUND' ? 404 : 422 }
    );
  }
}
