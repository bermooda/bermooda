import { move } from '@dnd-kit/helpers';
import { DragDropProvider } from '@dnd-kit/react';
import { useSortable } from '@dnd-kit/react/sortable';
import { Bars3Icon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { useEffect, useState } from 'react';

import { useT } from '#/core/i18n';

/**
 * Drag handle for sortable list rows.
 *
 * @param {{ handleRef: (element: Element | null) => void, disabled?: boolean, className?: string }} props
 * @returns {React.ReactElement}
 */
export function SortableGrip({ handleRef, disabled = false, className }) {
  const t = useT();
  const dragLabel = t('admin.sortable.dragToReorder');

  return (
    <button
      ref={handleRef}
      type="button"
      disabled={disabled}
      title={dragLabel}
      aria-label={dragLabel}
      className={clsx(
        'text-text-muted hover:text-text cursor-grab touch-none rounded p-1 active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-30',
        className
      )}
    >
      <Bars3Icon className="h-4 w-4" />
    </button>
  );
}

/**
 * @param {Array<unknown>} items
 * @param {(item: unknown) => string} getId
 * @param {(item: unknown) => string | undefined} [getGroup]
 */
function buildGroups(items, getId, getGroup) {
  /** @type {Record<string, string[]>} */
  const groups = {};

  for (const item of items) {
    const group = getGroup?.(item) ?? 'default';
    if (!groups[group]) groups[group] = [];
    groups[group].push(getId(item));
  }

  return groups;
}

/**
 * @param {Array<unknown>} items
 * @param {string[]} orderedIds
 * @param {(item: unknown) => string} getId
 */
function reorderItemsByIds(items, orderedIds, getId) {
  const itemMap = new Map(items.map((item) => [getId(item), item]));
  return orderedIds.map((id) => itemMap.get(id)).filter(Boolean);
}

/**
 * @param {Array<unknown>} items
 * @param {(item: unknown) => string} getId
 * @param {(item: unknown) => string | undefined} [getGroup]
 * @param {import('@dnd-kit/dom').DragEndEvent} event
 * @param {(items: unknown[], event: import('@dnd-kit/dom').DragEndEvent, groups: Record<string, string[]>) => unknown[]} [rebuildItems]
 */
function computeNextItems(items, getId, getGroup, event, rebuildItems) {
  if (getGroup) {
    const groups = buildGroups(items, getId, getGroup);
    const nextGroups = move(groups, event);

    if (rebuildItems) {
      return rebuildItems(items, event, nextGroups);
    }

    return items;
  }

  const ids = items.map(getId);
  const nextIds = move(ids, event);
  return reorderItemsByIds(items, nextIds, getId);
}

/**
 * @param {{ id: string, index: number, group?: string, disabled?: boolean, className?: string, children: (dragProps: { handleRef: (element: Element | null) => void, isDragging: boolean }) => React.ReactNode }} props
 */
function SortableListItem({
  id,
  index,
  group,
  disabled = false,
  className,
  children,
}) {
  const { ref, handleRef, isDragging } = useSortable({
    id,
    index,
    group,
    disabled,
  });

  return (
    <li ref={ref} className={clsx(className, isDragging && 'opacity-50')}>
      {children({ handleRef, isDragging })}
    </li>
  );
}

/**
 * Drag-and-drop sortable list built on @dnd-kit/react.
 *
 * @param {Object} props
 * @param {unknown[]} props.items
 * @param {(item: unknown) => string} props.getId
 * @param {(item: unknown) => string | undefined} [props.getGroup]
 * @param {(items: unknown[]) => void} props.onReorder
 * @param {(items: unknown[], event: import('@dnd-kit/dom').DragEndEvent, groups: Record<string, string[]>) => unknown[]} [props.rebuildItems]
 * @param {(item: unknown, index: number, dragProps: { handleRef: (element: Element | null) => void, isDragging: boolean }) => React.ReactNode} props.renderItem
 * @param {boolean} [props.disabled]
 * @param {'ol'|'ul'} [props.as]
 * @param {string} [props.className]
 * @param {string} [props.itemClassName]
 */
export default function SortableList({
  items: initialItems,
  getId,
  getGroup,
  onReorder,
  rebuildItems,
  renderItem,
  disabled = false,
  as: ListTag = 'ol',
  className,
  itemClassName,
}) {
  const [items, setItems] = useState(initialItems);

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  return (
    <DragDropProvider
      onDragEnd={(event) => {
        if (event.canceled) return;

        const nextItems = computeNextItems(
          items,
          getId,
          getGroup,
          event,
          rebuildItems
        );

        if (nextItems === items) return;

        setItems(nextItems);
        onReorder(nextItems);
      }}
    >
      <ListTag className={className}>
        {items.map((item, index) => (
          <SortableListItem
            key={getId(item)}
            id={getId(item)}
            index={index}
            group={getGroup?.(item)}
            disabled={disabled}
            className={itemClassName}
          >
            {(dragProps) => renderItem(item, index, dragProps)}
          </SortableListItem>
        ))}
      </ListTag>
    </DragDropProvider>
  );
}
