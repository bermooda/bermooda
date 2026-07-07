// app/core/pos/index.server.js
// Point-of-sale draft orders for in-store checkout.

import logger from '#/utils/logger.server';
import prisma from '#/libs/prisma.server';
import { listLocations } from '#/core/inventory/index.server';

export const POS_SESSION_STATUSES = ['open', 'closed'];
export const POS_ORDER_STATUSES = ['draft', 'completed'];

export const DEFAULT_SESSION_LIST_LIMIT = 20;
export const MAX_SESSION_LIST_RESULTS = 100;

const POS_SESSION_STATUS_SET = new Set(POS_SESSION_STATUSES);

const SESSION_LIST_INCLUDE = {
  location: { select: { id: true, name: true } },
  orders: {
    select: { id: true, status: true, totalCents: true, currency: true },
  },
  staff: { select: { id: true, name: true, email: true } },
};

const SESSION_DETAIL_INCLUDE = {
  location: { select: { id: true, name: true } },
  orders: {
    select: {
      id: true,
      status: true,
      totalCents: true,
      currency: true,
      orderId: true,
      createdAt: true,
    },
  },
  staff: { select: { id: true, name: true, email: true } },
};

// ---------------------------------------------------------------------------
// Input parsing
// ---------------------------------------------------------------------------

function parseListPagination(source, defaults) {
  const get = (key) => {
    if (source instanceof URLSearchParams) {
      const value = source.get(key);
      return value === null || value === '' ? undefined : value;
    }
    const value = source[key];
    if (value === null || value === undefined || value === '') return undefined;
    return value.toString();
  };

  const page = Math.max(1, parseInt(get('page') ?? '1', 10) || 1);
  const limit = Math.min(
    Math.max(
      1,
      parseInt(get('limit') ?? String(defaults.limit), 10) || defaults.limit
    ),
    defaults.max
  );

  return { page, limit };
}

/**
 * Parse POS session list query params.
 *
 * @param {URLSearchParams|Record<string, string|undefined|null>} [source]
 */
export function parseSessionListParams(source = {}) {
  const { page, limit } = parseListPagination(source, {
    limit: DEFAULT_SESSION_LIST_LIMIT,
    max: MAX_SESSION_LIST_RESULTS,
  });

  const get = (key) => {
    if (source instanceof URLSearchParams) {
      const value = source.get(key);
      return value === null || value === '' ? undefined : value;
    }
    const value = source[key];
    if (value === null || value === undefined || value === '') return undefined;
    return value.toString();
  };

  const staffId = get('staffId')?.trim();
  const locationId = get('locationId')?.trim();
  const status = get('status')?.trim();

  if (status && !POS_SESSION_STATUS_SET.has(status)) {
    throw Object.assign(new Error('Invalid POS session status filter.'), {
      code: 'INVALID_POS_SESSION_STATUS',
    });
  }

  return {
    page,
    limit,
    ...(staffId ? { staffId } : {}),
    ...(locationId ? { locationId } : {}),
    ...(status ? { status } : {}),
  };
}

/**
 * Build a Prisma where clause for POS session list filters.
 *
 * @param {{ staffId?: string, locationId?: string, status?: string }} filters
 */
export function buildSessionWhere({ staffId, locationId, status } = {}) {
  const where = {};
  if (staffId) where.staffId = staffId;
  if (locationId) where.locationId = locationId;
  if (status) where.status = status;
  return where;
}

/**
 * Parse admin/API open-session payload.
 *
 * @param {object} input
 */
export function parseOpenSessionInput(input = {}) {
  const staffId = input.staffId?.toString().trim();
  const locationId = input.locationId?.toString().trim() || null;

  if (!staffId) {
    throw Object.assign(new Error('staffId is required.'), {
      code: 'STAFF_ID_REQUIRED',
    });
  }

  return { staffId, locationId };
}

/**
 * Parse admin form open-session submission.
 *
 * @param {FormData} formData
 * @param {{ staffId: string }} context
 */
export function parseOpenSessionFromForm(formData, { staffId }) {
  const locationId = formData.get('locationId')?.toString().trim() || null;
  return parseOpenSessionInput({ staffId, locationId });
}

/**
 * Parse admin/API close-session payload.
 *
 * @param {object} input
 */
export function parseCloseSessionInput(input = {}) {
  const sessionId = input.sessionId?.toString().trim();

  if (!sessionId) {
    throw Object.assign(new Error('sessionId is required.'), {
      code: 'SESSION_ID_REQUIRED',
    });
  }

  return { sessionId };
}

/**
 * Parse admin form close-session submission.
 *
 * @param {FormData} formData
 */
export function parseCloseSessionFromForm(formData) {
  return parseCloseSessionInput({
    sessionId: formData.get('sessionId'),
  });
}

/**
 * Parse admin/API create-draft-order payload.
 *
 * @param {object} input
 */
export function parseCreateDraftOrderInput(input = {}) {
  const posSessionId = input.posSessionId?.toString().trim();
  const sessionId = input.sessionId?.toString().trim();
  const resolvedSessionId = posSessionId || sessionId;

  const totalCents =
    typeof input.totalCents === 'number'
      ? input.totalCents
      : parseInt(String(input.totalCents ?? '0'), 10);

  const currency = input.currency?.toString().trim().toUpperCase() || 'USD';

  if (!resolvedSessionId) {
    throw Object.assign(new Error('sessionId is required.'), {
      code: 'SESSION_ID_REQUIRED',
    });
  }

  if (!Number.isInteger(totalCents) || totalCents < 0) {
    throw Object.assign(
      new Error('totalCents must be a non-negative integer.'),
      {
        code: 'INVALID_TOTAL_CENTS',
      }
    );
  }

  if (!currency) {
    throw Object.assign(new Error('currency is required.'), {
      code: 'CURRENCY_REQUIRED',
    });
  }

  return {
    posSessionId: resolvedSessionId,
    totalCents,
    currency,
  };
}

/**
 * Parse admin form create-draft-order submission.
 *
 * @param {FormData} formData
 */
export function parseCreateDraftOrderFromForm(formData) {
  return parseCreateDraftOrderInput({
    sessionId: formData.get('sessionId'),
    totalCents: formData.get('totalCents'),
    currency: formData.get('currency'),
  });
}

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

/**
 * @param {object} session
 */
export function serializeSession(session) {
  return {
    id: session.id,
    staffId: session.staffId,
    locationId: session.locationId,
    status: session.status,
    openedAt: session.openedAt,
    closedAt: session.closedAt,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    location: session.location ?? null,
    staff: session.staff ?? null,
    orders: Array.isArray(session.orders)
      ? session.orders.map(serializePosOrder)
      : [],
    orderCount: Array.isArray(session.orders) ? session.orders.length : 0,
  };
}

/**
 * @param {object} order
 */
export function serializePosOrder(order) {
  return {
    id: order.id,
    posSessionId: order.posSessionId,
    orderId: order.orderId ?? null,
    status: order.status,
    totalCents: order.totalCents,
    currency: order.currency,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// Admin loaders
// ---------------------------------------------------------------------------

/**
 * Load data for the admin POS index page.
 *
 * @param {{ staffId: string }} options
 */
export async function loadPosAdminIndexData({ staffId }) {
  const [{ sessions, total, page, limit }, locations, staffSessions] =
    await Promise.all([
      listPosSessions({ limit: DEFAULT_SESSION_LIST_LIMIT }),
      listLocations(),
      listPosSessions({ staffId, status: 'open', limit: 1 }),
    ]);

  const openSession = staffSessions.sessions[0] ?? null;

  return {
    locations,
    sessions,
    total,
    page,
    limit,
    openSession,
    staffId,
  };
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

async function requireSessionRecord(
  sessionId,
  include = SESSION_DETAIL_INCLUDE
) {
  const session = await prisma.posSession.findUnique({
    where: { id: sessionId },
    include,
  });

  if (!session) {
    throw Object.assign(new Error('POS session not found.'), {
      code: 'NOT_FOUND',
    });
  }

  return session;
}

async function requireOpenSession(sessionId) {
  const session = await requireSessionRecord(sessionId, { orders: true });

  if (session.status !== 'open') {
    throw Object.assign(new Error('POS session is not open.'), {
      code: 'SESSION_NOT_OPEN',
    });
  }

  return session;
}

/**
 * List POS sessions with optional filters and pagination.
 *
 * @param {{
 *   staffId?: string,
 *   locationId?: string,
 *   status?: string,
 *   page?: number,
 *   limit?: number,
 * }} [options]
 */
export async function listPosSessions(options = {}) {
  const params =
    options.page != null ||
    options.limit != null ||
    options.staffId != null ||
    options.locationId != null ||
    options.status != null
      ? options
      : parseSessionListParams(options);

  const safePage = Math.max(1, params.page ?? 1);
  const safeLimit = Math.min(
    Math.max(1, params.limit ?? DEFAULT_SESSION_LIST_LIMIT),
    MAX_SESSION_LIST_RESULTS
  );
  const skip = (safePage - 1) * safeLimit;
  const where = buildSessionWhere({
    staffId: params.staffId,
    locationId: params.locationId,
    status: params.status,
  });

  const [items, total] = await Promise.all([
    prisma.posSession.findMany({
      where,
      include: SESSION_LIST_INCLUDE,
      orderBy: { openedAt: 'desc' },
      skip,
      take: safeLimit,
    }),
    prisma.posSession.count({ where }),
  ]);

  return {
    sessions: items.map(serializeSession),
    total,
    page: safePage,
    limit: safeLimit,
    totalPages: Math.ceil(total / safeLimit) || 1,
  };
}

export async function getPosSession(sessionId) {
  const session = await requireSessionRecord(sessionId);
  return serializeSession(session);
}

export async function openPosSession(input) {
  const { staffId, locationId } = parseOpenSessionInput(input);

  if (locationId) {
    const location = await prisma.location.findUnique({
      where: { id: locationId },
      select: { id: true },
    });
    if (!location) {
      throw Object.assign(new Error('Location not found.'), {
        code: 'LOCATION_NOT_FOUND',
      });
    }
  }

  const existingOpen = await prisma.posSession.findFirst({
    where: { staffId, status: 'open' },
    select: { id: true },
  });
  if (existingOpen) {
    throw Object.assign(
      new Error('Staff member already has an open session.'),
      {
        code: 'SESSION_ALREADY_OPEN',
      }
    );
  }

  const session = await prisma.posSession.create({
    data: { staffId, locationId, status: 'open' },
    include: SESSION_DETAIL_INCLUDE,
  });

  logger.info({ sessionId: session.id, staffId }, 'POS session opened');
  return serializeSession(session);
}

export async function closePosSession(input) {
  const { sessionId } =
    typeof input === 'string'
      ? parseCloseSessionInput({ sessionId: input })
      : parseCloseSessionInput(input);

  await requireOpenSession(sessionId);

  const session = await prisma.posSession.update({
    where: { id: sessionId },
    data: { status: 'closed', closedAt: new Date() },
    include: SESSION_DETAIL_INCLUDE,
  });

  logger.info({ sessionId }, 'POS session closed');
  return serializeSession(session);
}

export async function createPosDraftOrder(input) {
  const data = parseCreateDraftOrderInput(input);
  await requireOpenSession(data.posSessionId);

  const order = await prisma.posOrder.create({
    data: {
      posSessionId: data.posSessionId,
      status: 'draft',
      currency: data.currency,
      totalCents: data.totalCents,
    },
  });

  logger.info(
    { posOrderId: order.id, posSessionId: data.posSessionId },
    'POS draft order created'
  );
  return serializePosOrder(order);
}
