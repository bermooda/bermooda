// GET /api/admin/v1/orders/:id/documents/invoice — download invoice PDF
// Requires admin-scoped API key.

import { generateInvoicePdf } from '#/core/documents/index.server';

export async function loader({ params }) {
  try {
    const pdf = await generateInvoicePdf(params.id);
    return new Response(pdf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="invoice-${params.id}.pdf"`,
      },
    });
  } catch (err) {
    return Response.json(
      { error: err.message, code: err.code },
      { status: err.message === 'ORDER_NOT_FOUND' ? 404 : 422 }
    );
  }
}
