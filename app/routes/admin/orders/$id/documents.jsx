// GET /admin/orders/:id/documents — download invoice PDF

import { authenticate } from '#/libs/auth/admin.server';
import { generateInvoicePdf } from '#/core/documents/index.server';

export async function loader({ params, request }) {
  await authenticate(request);

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
      { error: err.message },
      { status: err.message?.includes('NOT_FOUND') ? 404 : 422 }
    );
  }
}
