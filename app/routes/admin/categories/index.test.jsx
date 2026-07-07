import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockDeleteCategoryRecursive,
  mockLoadCategoryAdminTreeData,
  mockReorderCategory,
  mockSaveCategoryAdminForm,
} = vi.hoisted(() => ({
  mockDeleteCategoryRecursive: vi.fn(),
  mockLoadCategoryAdminTreeData: vi.fn(),
  mockReorderCategory: vi.fn(),
  mockSaveCategoryAdminForm: vi.fn(),
}));

vi.mock('#/core/catalog/admin.server', () => ({
  deleteCategoryRecursive: mockDeleteCategoryRecursive,
  loadCategoryAdminTreeData: mockLoadCategoryAdminTreeData,
  reorderCategory: mockReorderCategory,
  saveCategoryAdminForm: mockSaveCategoryAdminForm,
}));

vi.mock('#/utils/logger.server', () => ({
  default: { error: vi.fn() },
}));

vi.mock('#/libs/alerting.server', () => ({
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

  it('reorder action delegates to reorderCategory', async () => {
    const response = await action({
      request: buildRequest('reorder-up', { id: 'cat_1' }),
    });

    expect(response).toEqual({ ok: true, intent: 'reorder-up' });
    expect(mockReorderCategory).toHaveBeenCalledWith('cat_1', 'reorder-up');
  });
});
