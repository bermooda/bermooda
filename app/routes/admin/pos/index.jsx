// app/routes/admin/pos/index.jsx
// Point-of-sale session admin UI.

import { Form, useLoaderData } from 'react-router';

import { authenticate } from '#/libs/auth/admin/index.server';
import { useT } from '#/core/i18n';
import {
  closePosSession,
  createPosDraftOrder,
  loadPosAdminIndexData,
  openPosSession,
  parseCloseSessionFromForm,
  parseCreateDraftOrderFromForm,
  parseOpenSessionFromForm,
} from '#/core/pos/index.server';
import Card from '#/components/admin/card';
import Select from '#/components/admin/form/select';
import PageHeader from '#/components/admin/page-header';
import Button from '#/components/ui/button';

export async function loader({ request }) {
  const { user } = await authenticate(request);
  return loadPosAdminIndexData({ staffId: user.id });
}

export async function action({ request }) {
  const { user } = await authenticate(request);
  const formData = await request.formData();
  const intent = formData.get('intent');

  if (intent === 'open-session') {
    try {
      const input = parseOpenSessionFromForm(formData, { staffId: user.id });
      await openPosSession(input);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  if (intent === 'close-session') {
    try {
      const input = parseCloseSessionFromForm(formData);
      await closePosSession(input);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  if (intent === 'create-draft') {
    try {
      const input = parseCreateDraftOrderFromForm(formData);
      await createPosDraftOrder(input);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  return { ok: false, error: 'Unknown action.' };
}

/**
 * @param {string} status
 * @param {(key: string) => string} t
 */
function posSessionStatusLabel(status, t) {
  const key = `admin.pos.status.${status}`;
  const label = t(key);
  return label === key ? status : label;
}

export default function AdminPosRoute() {
  const t = useT();
  const { locations, sessions, openSession, staffId } = useLoaderData();

  return (
    <div>
      <PageHeader
        title={t('admin.pos.index.title')}
        subtitle={t('admin.pos.index.subtitle')}
        className="mb-6"
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="text-text mb-4 text-sm font-semibold">
            {t('admin.pos.index.sessionHeading')}
          </h2>
          {openSession ? (
            <div className="space-y-4">
              <p className="text-text text-sm">
                {t('admin.pos.index.openSessionAt')}{' '}
                <span className="font-medium">
                  {openSession.location?.name ??
                    t('admin.pos.index.noLocation')}
                </span>
              </p>
              <Form method="post" className="space-y-3">
                <input type="hidden" name="intent" value="create-draft" />
                <input type="hidden" name="sessionId" value={openSession.id} />
                <input type="hidden" name="currency" value="USD" />
                <Button type="submit" variant="secondary">
                  {t('admin.pos.index.createDraft')}
                </Button>
              </Form>
              <Form method="post">
                <input type="hidden" name="intent" value="close-session" />
                <input type="hidden" name="sessionId" value={openSession.id} />
                <Button type="submit">
                  {t('admin.pos.index.closeSession')}
                </Button>
              </Form>
            </div>
          ) : (
            <Form method="post" className="space-y-4">
              <input type="hidden" name="intent" value="open-session" />
              <input type="hidden" name="staffId" value={staffId} />
              <div>
                <label className="text-text-muted mb-1 block text-xs font-medium">
                  {t('admin.pos.index.location')}
                </label>
                <Select name="locationId">
                  <option value="">
                    {t('admin.pos.index.locationDefault')}
                  </option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </Select>
              </div>
              <Button type="submit">{t('admin.pos.index.openSession')}</Button>
            </Form>
          )}
        </Card>

        <Card>
          <h2 className="text-text mb-4 text-sm font-semibold">
            {t('admin.pos.index.recentHeading')}
          </h2>
          {sessions.length === 0 ? (
            <p className="text-text-muted text-sm">
              {t('admin.pos.index.empty')}
            </p>
          ) : (
            <ul className="divide-border divide-y text-sm">
              {sessions.map((session) => (
                <li key={session.id} className="py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-text font-medium">
                      {session.location?.name ??
                        t('admin.pos.index.noLocation')}
                    </span>
                    <span
                      className={
                        session.status === 'open'
                          ? 'text-xs font-medium text-green-700'
                          : 'text-text-muted text-xs'
                      }
                    >
                      {posSessionStatusLabel(session.status, t)}
                    </span>
                  </div>
                  <p className="text-text-muted text-xs">
                    {t('admin.pos.index.draftsMeta', {
                      count: session.orderCount,
                    })}{' '}
                    · {session.staff?.name ?? session.staff?.email}
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
