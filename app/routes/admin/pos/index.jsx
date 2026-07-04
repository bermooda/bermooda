// app/routes/admin/pos/index.jsx
// Point-of-sale session admin UI.

import { Form, useLoaderData } from 'react-router';

import { authenticate } from '#/libs/auth/admin.server';
import prisma from '#/libs/prisma.server';
import Card from '#/components/admin/card';
import Select from '#/components/admin/form/select';
import PageHeader from '#/components/admin/page-header';
import Button from '#/components/ui/button';

import { listLocations } from '#/core/inventory/index.server';
import {
  closePosSession,
  createPosDraftOrder,
  openPosSession,
} from '#/core/pos/index.server';

export async function loader({ request }) {
  const { user } = await authenticate(request);

  const [locations, sessions] = await Promise.all([
    listLocations(),
    prisma.posSession.findMany({
      orderBy: { openedAt: 'desc' },
      take: 20,
      include: {
        location: true,
        orders: true,
        staff: { select: { id: true, name: true, email: true } },
      },
    }),
  ]);

  const openSession = sessions.find((s) => s.status === 'open') ?? null;

  return { locations, sessions, openSession, staffId: user.id };
}

export async function action({ request }) {
  const { user } = await authenticate(request);
  const formData = await request.formData();
  const intent = formData.get('intent');

  if (intent === 'open-session') {
    const locationId = formData.get('locationId')?.toString() || null;
    await openPosSession({ staffId: user.id, locationId });
    return { ok: true };
  }

  if (intent === 'close-session') {
    const sessionId = formData.get('sessionId')?.toString();
    if (!sessionId) return { ok: false, error: 'Session required.' };
    await closePosSession(sessionId);
    return { ok: true };
  }

  if (intent === 'create-draft') {
    const sessionId = formData.get('sessionId')?.toString();
    const totalCents = parseInt(
      formData.get('totalCents')?.toString() ?? '0',
      10
    );
    const currency = formData.get('currency')?.toString() ?? 'USD';

    if (!sessionId) return { ok: false, error: 'Session required.' };

    await createPosDraftOrder({
      posSessionId: sessionId,
      totalCents: Number.isNaN(totalCents) ? 0 : totalCents,
      currency,
    });

    return { ok: true };
  }

  return { ok: false, error: 'Unknown action.' };
}

export default function AdminPosRoute() {
  const { locations, sessions, openSession, staffId } = useLoaderData();

  return (
    <div>
      <PageHeader
        title="Point of sale"
        subtitle="In-store sessions and draft orders. Complete drafts via manual payment in Orders."
        className="mb-6"
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="text-text mb-4 text-sm font-semibold">Session</h2>
          {openSession ? (
            <div className="space-y-4">
              <p className="text-text text-sm">
                Open session at{' '}
                <span className="font-medium">
                  {openSession.location?.name ?? 'No location'}
                </span>
              </p>
              <Form method="post" className="space-y-3">
                <input type="hidden" name="intent" value="create-draft" />
                <input type="hidden" name="sessionId" value={openSession.id} />
                <input type="hidden" name="currency" value="USD" />
                <Button type="submit" variant="secondary">
                  Create draft order ($0)
                </Button>
              </Form>
              <Form method="post">
                <input type="hidden" name="intent" value="close-session" />
                <input type="hidden" name="sessionId" value={openSession.id} />
                <Button type="submit">Close session</Button>
              </Form>
            </div>
          ) : (
            <Form method="post" className="space-y-4">
              <input type="hidden" name="intent" value="open-session" />
              <input type="hidden" name="staffId" value={staffId} />
              <div>
                <label className="text-text-muted mb-1 block text-xs font-medium">
                  Location
                </label>
                <Select name="locationId">
                  <option value="">Default</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </Select>
              </div>
              <Button type="submit">Open POS session</Button>
            </Form>
          )}
        </Card>

        <Card>
          <h2 className="text-text mb-4 text-sm font-semibold">
            Recent sessions
          </h2>
          {sessions.length === 0 ? (
            <p className="text-text-muted text-sm">No POS sessions yet.</p>
          ) : (
            <ul className="divide-border divide-y text-sm">
              {sessions.map((session) => (
                <li key={session.id} className="py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-text font-medium">
                      {session.location?.name ?? 'No location'}
                    </span>
                    <span
                      className={
                        session.status === 'open'
                          ? 'text-xs font-medium text-green-700'
                          : 'text-text-muted text-xs'
                      }
                    >
                      {session.status}
                    </span>
                  </div>
                  <p className="text-text-muted text-xs">
                    {session.orders.length} draft(s) ·{' '}
                    {session.staff?.name ?? session.staff?.email}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
