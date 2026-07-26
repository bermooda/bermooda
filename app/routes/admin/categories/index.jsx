// app/routes/admin/categories/index.jsx
// Category tree — list, drag-and-drop reorder, delete. Edit on /:id.

import {
  PencilSquareIcon,
  TrashIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { useEffect, useState } from 'react';
import {
  Form,
  Link,
  useFetcher,
  useLoaderData,
  useNavigation,
} from 'react-router';

import { handleAdminActionError } from '#/libs/api/admin-ui/index.server';
import {
  deleteCategoryRecursive,
  loadCategoryAdminTreeData,
  setCategorySiblingOrder,
} from '#/core/catalog/admin/index.server';
import Badge from '#/components/admin/badge';
import Card from '#/components/admin/card';
import PageHeader from '#/components/admin/page-header';
import SortableList, { SortableGrip } from '#/components/admin/sortable-list';

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export async function loader() {
  return loadCategoryAdminTreeData();
}

// ---------------------------------------------------------------------------
// Action
// ---------------------------------------------------------------------------

export async function action({ request }) {
  const formData = await request.formData();
  const intent = formData.get('intent');

  // ── Delete ─────────────────────────────────────────────────────────────────
  if (intent === 'delete') {
    const id = formData.get('id')?.toString();
    if (!id) return { ok: false, error: 'Missing id.' };

    try {
      await deleteCategoryRecursive(id);
      return { ok: true, intent: 'delete' };
    } catch (err) {
      return handleAdminActionError(err, {
        source: 'admin.categories.delete',
        intent: 'delete',
        userMessage: 'Could not delete category.',
      });
    }
  }

  // ── Reorder siblings via drag and drop ────────────────────────────────────
  if (intent === 'reorder') {
    const parentId = formData.get('parentId')?.toString() || null;
    const orderRaw = formData.get('order')?.toString();

    if (!orderRaw) return { ok: false, error: 'Missing order.' };

    let orderedIds;
    try {
      orderedIds = JSON.parse(orderRaw);
    } catch {
      return { ok: false, error: 'Invalid order.' };
    }

    if (!Array.isArray(orderedIds)) {
      return { ok: false, error: 'Invalid order.' };
    }

    try {
      await setCategorySiblingOrder(parentId, orderedIds);
      return { ok: true, intent: 'reorder' };
    } catch (err) {
      return handleAdminActionError(err, {
        source: 'admin.categories.reorder',
        intent: 'reorder',
        knownCodes: {
          INVALID_ORDER: { ok: false, error: 'Invalid category order.' },
        },
        userMessage: 'Could not reorder category.',
      });
    }
  }

  return { ok: false, error: 'Unknown intent.' };
}

/**
 * Rebuild the flat category tree after sibling order changes.
 *
 * @param {Array<{ id: string, parentId: string | null, depth: number }>} tree
 * @param {string | null} parentId
 * @param {string[]} orderedSiblingIds
 */
function rebuildCategoryTree(tree, parentId, orderedSiblingIds) {
  const nodeMap = new Map(tree.map((node) => [node.id, node]));
  /** @type {Map<string | null, Array<typeof tree[number]>>} */
  const childrenByParent = new Map();

  for (const node of tree) {
    const key = node.parentId ?? null;
    if (!childrenByParent.has(key)) childrenByParent.set(key, []);
    childrenByParent.get(key).push(node);
  }

  const reorderedSiblings = orderedSiblingIds
    .map((id) => nodeMap.get(id))
    .filter(Boolean);
  childrenByParent.set(parentId, reorderedSiblings);

  /** @param {string | null} currentParentId @param {number} depth */
  function walk(currentParentId, depth) {
    const children = childrenByParent.get(currentParentId) ?? [];
    return children.flatMap((child) => [
      { ...child, depth },
      ...walk(child.id, depth + 1),
    ]);
  }

  return walk(null, 0);
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function AdminCategoriesRoute() {
  const { tree: loaderTree } = useLoaderData();
  const navigation = useNavigation();
  const reorderFetcher = useFetcher();
  const [tree, setTree] = useState(loaderTree);

  useEffect(() => {
    setTree(loaderTree);
  }, [loaderTree]);

  const isReordering =
    reorderFetcher.state !== 'idle' ||
    (navigation.state === 'submitting' &&
      navigation.formData?.get('intent') === 'reorder');

  function persistSiblingOrder(parentId, orderedSiblingIds) {
    const formData = new FormData();
    formData.set('intent', 'reorder');
    formData.set('parentId', parentId ?? '');
    formData.set('order', JSON.stringify(orderedSiblingIds));
    reorderFetcher.submit(formData, { method: 'post' });
  }

  return (
    <div>
      <PageHeader
        title="Categories"
        subtitle={`${tree.length} categor${tree.length !== 1 ? 'ies' : 'y'}`}
        actions={
          <Link
            to="/admin/categories/new"
            className="bg-accent text-accent-fg hover:bg-accent-hover focus-visible:outline-accent inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-semibold shadow-sm transition focus-visible:outline focus-visible:outline-offset-2"
          >
            <PlusIcon className="h-4 w-4" />
            New category
          </Link>
        }
        className="mb-6"
      />

      <Card padded={false} className="overflow-hidden">
        {tree.length === 0 ? (
          <div className="text-text-muted px-4 py-10 text-center text-sm">
            No categories yet.{' '}
            <Link
              to="/admin/categories/new"
              className="text-accent hover:underline"
            >
              Create your first category
            </Link>
            .
          </div>
        ) : (
          <SortableList
            items={tree}
            getId={(cat) => cat.id}
            getGroup={(cat) => cat.parentId ?? 'root'}
            disabled={isReordering}
            as="ul"
            className="divide-border divide-y"
            itemClassName="list-none"
            rebuildItems={(currentTree, event, groups) => {
              const source = event.operation.source;
              const sourceId = source?.id?.toString();
              if (!sourceId) return currentTree;

              const sourceNode = currentTree.find((cat) => cat.id === sourceId);
              if (!sourceNode) return currentTree;

              const parentId = sourceNode.parentId ?? null;
              const groupKey = parentId ?? 'root';
              const orderedSiblingIds = groups[groupKey] ?? [];

              return rebuildCategoryTree(
                currentTree,
                parentId,
                orderedSiblingIds
              );
            }}
            onReorder={(nextTree) => {
              for (const parentId of new Set(
                nextTree.map((cat) => cat.parentId ?? null)
              )) {
                const orderedSiblingIds = nextTree
                  .filter((cat) => (cat.parentId ?? null) === parentId)
                  .map((cat) => cat.id);

                const previousSiblingIds = tree
                  .filter((cat) => (cat.parentId ?? null) === parentId)
                  .map((cat) => cat.id);

                if (
                  orderedSiblingIds.join(',') !== previousSiblingIds.join(',')
                ) {
                  setTree(nextTree);
                  persistSiblingOrder(parentId, orderedSiblingIds);
                  return;
                }
              }

              setTree(nextTree);
            }}
            renderItem={(cat, _index, { handleRef, isDragging }) => (
              <div
                className={clsx(
                  'hover:bg-surface-2/50 flex items-center gap-3 px-4 py-3',
                  (isReordering || isDragging) && 'opacity-60'
                )}
                style={{ paddingLeft: `${16 + cat.depth * 24}px` }}
              >
                <SortableGrip
                  handleRef={handleRef}
                  disabled={isReordering}
                  className="shrink-0"
                />

                {cat.depth > 0 && (
                  <span className="text-text-muted mr-1 shrink-0 select-none">
                    {'└'}
                  </span>
                )}

                <Link
                  to={`/admin/categories/${cat.id}`}
                  className="text-text hover:text-accent flex-1 text-sm font-medium"
                >
                  {cat.enTitle || (
                    <span className="text-text-muted italic">(untitled)</span>
                  )}
                </Link>

                <span className="bg-surface-2 text-text-muted shrink-0 rounded px-1.5 py-0.5 font-mono text-xs">
                  pos {cat.position}
                </span>

                {cat.childCount > 0 && (
                  <Badge tone="accent">
                    {cat.childCount} child{cat.childCount !== 1 ? 'ren' : ''}
                  </Badge>
                )}

                <Link
                  to={`/admin/categories/${cat.id}`}
                  title="Edit"
                  className="text-text-muted hover:text-text rounded p-1"
                >
                  <PencilSquareIcon className="h-4 w-4" />
                </Link>

                <Form
                  method="post"
                  onSubmit={(e) => {
                    if (
                      !window.confirm(
                        cat.childCount > 0
                          ? `Delete "${cat.enTitle || 'this category'}" and its ${cat.childCount} child categor${cat.childCount !== 1 ? 'ies' : 'y'}? This cannot be undone.`
                          : `Delete "${cat.enTitle || 'this category'}"? This cannot be undone.`
                      )
                    ) {
                      e.preventDefault();
                    }
                  }}
                >
                  <input type="hidden" name="intent" value="delete" />
                  <input type="hidden" name="id" value={cat.id} />
                  <button
                    type="submit"
                    title="Delete"
                    className="text-text-muted hover:text-danger rounded p-1"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </Form>
              </div>
            )}
          />
        )}
      </Card>
    </div>
  );
}
