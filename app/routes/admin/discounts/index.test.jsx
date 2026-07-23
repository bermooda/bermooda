import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockCreateDiscount,
  mockDeleteDiscount,
  mockListDiscounts,
  mockToggleDiscountActive,
  mockUpdateDiscount,
} = vi.hoisted(() => ({
  mockCreateDiscount: vi.fn(),
  mockDeleteDiscount: vi.fn(),
  mockListDiscounts: vi.fn(),
  mockToggleDiscountActive: vi.fn(),
  mockUpdateDiscount: vi.fn(),
}));

vi.mock('#/core/discounts/index.server', () => ({
  createDiscount: mockCreateDiscount,
  deleteDiscount: mockDeleteDiscount,
  listDiscounts: mockListDiscounts,
  parseDiscountFormData: vi.fn((formData, opts = {}) => {
    const code = formData.get('code')?.toString().trim().toUpperCase() ?? '';
    if (!code) return { error: 'Code is required.' };
    return {
      data: {
        code,
        type: formData.get('type')?.toString() ?? 'percent',
        value: parseInt(formData.get('value') ?? '0', 10),
        minSubtotalCents: null,
        maxUsesCount: null,
        currency: null,
        expiresAt: null,
        ...(opts.active !== undefined ? { active: opts.active } : {}),
      },
    };
  }),
  toggleDiscountActive: mockToggleDiscountActive,
  updateDiscount: mockUpdateDiscount,
}));

vi.mock('#/utils/logger.server', () => ({
  default: { error: vi.fn() },
}));

vi.mock('#/libs/alerting/index.server', () => ({
  sendErrorAlert: vi.fn(),
}));

import { action, loader } from '#/routes/admin/discounts/index';

function buildRequest(intent, fields = {}) {
  const formData = new FormData();
  formData.set('intent', intent);
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }

  return new Request('http://localhost/admin/discounts', {
    method: 'POST',
    body: formData,
  });
}

describe('admin discounts route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListDiscounts.mockResolvedValue({ discounts: [], total: 0 });
  });

  it('loader uses core listDiscounts', async () => {
    mockListDiscounts.mockResolvedValue({
      discounts: [{ id: 'd1', code: 'SAVE10' }],
      total: 1,
    });

    const data = await loader();

    expect(data.discounts).toHaveLength(1);
    expect(mockListDiscounts).toHaveBeenCalledWith({
      page: 1,
      limit: 500,
      orderBy: { createdAt: 'desc' },
    });
  });

  it('save intent updates a discount through core', async () => {
    mockUpdateDiscount.mockResolvedValue({ id: 'd1' });

    const result = await action({
      request: buildRequest('save', {
        id: 'd1',
        code: 'save10',
        type: 'percent',
        value: '10',
        active: 'true',
      }),
    });

    expect(result).toEqual({ ok: true, intent: 'save' });
    expect(mockUpdateDiscount).toHaveBeenCalledWith('d1', {
      code: 'SAVE10',
      type: 'percent',
      value: 10,
      minSubtotalCents: null,
      maxUsesCount: null,
      currency: null,
      expiresAt: null,
      active: true,
    });
  });

  it('delete intent removes a discount through core', async () => {
    mockDeleteDiscount.mockResolvedValue(undefined);

    const result = await action({
      request: buildRequest('delete', { id: 'd1' }),
    });

    expect(result).toEqual({ ok: true, intent: 'delete' });
    expect(mockDeleteDiscount).toHaveBeenCalledWith('d1');
  });

  it('toggle-active intent uses core helper', async () => {
    mockToggleDiscountActive.mockResolvedValue({ id: 'd1', active: false });

    const result = await action({
      request: buildRequest('toggle-active', { id: 'd1' }),
    });

    expect(result).toEqual({ ok: true, intent: 'toggle-active' });
    expect(mockToggleDiscountActive).toHaveBeenCalledWith('d1');
  });

  it('returns validation errors without calling core', async () => {
    const result = await action({
      request: buildRequest('save', {
        id: 'd1',
        type: 'percent',
        value: '10',
        active: 'true',
      }),
    });

    expect(result).toEqual({
      ok: false,
      error: 'Code is required.',
      intent: 'save',
    });
    expect(mockUpdateDiscount).not.toHaveBeenCalled();
  });
});
