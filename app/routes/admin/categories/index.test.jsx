import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockDeleteCategoryRecursive,
  mockLoadCategoryAdminTreeData,
  mockSetCategorySiblingOrder,
  mockSaveCategoryAdminForm,
} = vi.hoisted(() => ({
  mockDeleteCategoryRecursive: vi.fn(),
  mockLoadCategoryAdminTreeData: vi.fn(),
  mockSetCategorySiblingOrder: vi.fn(),
  mockSaveCategoryAdminForm: vi.fn(),
}));

vi.mock('#/core/catalog/admin/index.server', () => ({
  deleteCategoryRecursive: mockDeleteCategoryRecursive,
  loadCategoryAdminTreeData: mockLoadCategoryAdminTreeData,
  setCategorySiblingOrder: mockSetCategorySiblingOrder,
  saveCategoryAdminForm: mockSaveCategoryAdminForm,
}));

vi.mock('#/utils/logger.server', () => ({
  default: { error: vi.fn() },
}));

vi.mock('#/libs/alerting/index.server', () => ({
  sendErrorAlert: vi.fn(),
}));

import { action, loader } from '#/routes/admin/categories/index';

function buildRequest(intent, fields = {}) {
  const formData = new FormData();
  formData.set('intent', intent);
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }

  return new Request('http://localhost/admin/categories', {
    method: 'POST',
    body: formData,
  });
}

describe('admin categories route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadCategoryAdminTreeData.mockResolvedValue({
      tree: [],
      locales: ['en'],
    });
  });

  it('loader uses core loadCategoryAdminTreeData', async () => {
    mockLoadCategoryAdminTreeData.mockResolvedValue({
      tree: [{ id: 'cat_1', enTitle: 'Root' }],
      locales: ['en', 'de'],
    });

    const data = await loader();

    expect(data.tree).toHaveLength(1);
    expect(data.locales).toEqual(['en', 'de']);
    expect(mockLoadCategoryAdminTreeData).toHaveBeenCalled();
  });

  it('save action delegates to saveCategoryAdminForm', async () => {
    const response = await action({
      request: buildRequest('save', { id: 'cat_1' }),
    });

    expect(response).toEqual({ ok: true, intent: 'save' });
    expect(mockSaveCategoryAdminForm).toHaveBeenCalledWith(
      'cat_1',
      expect.any(FormData)
    );
  });

  it('delete action delegates to deleteCategoryRecursive', async () => {
    const response = await action({
      request: buildRequest('delete', { id: 'cat_1' }),
    });

    expect(response).toEqual({ ok: true, intent: 'delete' });
    expect(mockDeleteCategoryRecursive).toHaveBeenCalledWith('cat_1');
  });

  it('reorder action delegates to setCategorySiblingOrder', async () => {
    const response = await action({
      request: buildRequest('reorder', {
        parentId: '',
        order: JSON.stringify(['cat_1', 'cat_2']),
      }),
    });

    expect(response).toEqual({ ok: true, intent: 'reorder' });
    expect(mockSetCategorySiblingOrder).toHaveBeenCalledWith(null, [
      'cat_1',
      'cat_2',
    ]);
  });
});
