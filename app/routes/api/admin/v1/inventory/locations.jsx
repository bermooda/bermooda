import { requireApiKey } from '#/libs/auth/api.server';
import prisma from '#/libs/prisma.server';

export async function loader({ request }) {
  await requireApiKey(request, ['admin']);

  const locations = await prisma.location.findMany({
    orderBy: { name: 'asc' },
    include: {
      inventoryLevels: {
        include: {
          variant: { select: { id: true, sku: true, productId: true } },
        },
      },
    },
  });

  return Response.json({ locations });
}
