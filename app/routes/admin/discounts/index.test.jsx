import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockDeleteDiscount, mockListDiscounts, mockToggleDiscountActive } =
  vi.hoisted(() => ({
    mockDeleteDiscount: vi.fn(),
    mockListDiscounts: vi.fn(),
    mockToggleDiscountActive: vi.fn(),
  }));

vi.mock('#/core/discounts/index.server', () => ({
  deleteDiscount: mockDeleteDiscount,
  listDiscounts: mockListDiscounts,
  toggleDiscountActive: mockToggleDiscountActive,
}));

vi.mock('#/utils/logger.server', () => ({
  default: { error: vi.fn() },
}));

vi.mock('#/libs/alerting/index.server', () => ({
  sendErrorAlert: vi.fn(),
}));

import { action, loader } from '#/routes/admin/discounts';

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
});
