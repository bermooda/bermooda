// GET /api/admin/v1/customers — list customers
// Requires admin-scoped API key.

import { requireApiKey } from '#/libs/auth/api.server';
import prisma from '#/libs/prisma.server';

export async function loader({ request }) {
  await requireApiKey(request, ['admin']);

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') ?? '1', 10);
  const limit = Math.min(
    parseInt(url.searchParams.get('limit') ?? '20', 10),
    100
  );
  const skip = (page - 1) * limit;

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        preferredLocale: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.customer.count(),
  ]);

  return Response.json({ customers, total, page, limit });
}
