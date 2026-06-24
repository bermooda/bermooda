import { Dialog, DialogPanel } from '@headlessui/react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import {
  filterCommandItems,
  getAllCommandItems,
  groupCommandItems,
} from '#/components/admin/nav-config';

/**
 * Command palette overlay for keyboard-driven admin navigation.
 *
 * @param {Object} props
 * @param {boolean} props.open
 * @param {(open: boolean) => void} props.onOpenChange
 * @returns {React.ReactElement}
 */
export default function CommandPalette({ open, onOpenChange }) {
  const navigate = useNavigate();
  const listboxId = useId();
  const inputRef = useRef(/** @type {HTMLInputElement | null} */ (null));
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const allItems = useMemo(() => getAllCommandItems(), []);
  const filteredItems = useMemo(
    () => filterCommandItems(allItems, query),
    [allItems, query]
  );
  const groupedItems = useMemo(
    () => groupCommandItems(filteredItems),
    [filteredItems]
  );

  useEffect(() => {
    if (!open) {
      setQuery('');
      setSelectedIndex(0);
      return;
    }

    const frame = requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });

    return () => cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (selectedIndex >= filteredItems.length) {
      setSelectedIndex(Math.max(0, filteredItems.length - 1));
    }
  }, [filteredItems.length, selectedIndex]);

  /**
   * Navigate to the selected command item and close the palette.
   *
   * @param {ReturnType<typeof getAllCommandItems>[number]} item
   */
  function selectItem(item) {
    onOpenChange(false);

    if (item.external) {
      window.open(item.href, '_blank', 'noopener,noreferrer');
      return;
    }

    navigate(item.href);
  }

  /**
   * Handle keyboard navigation inside the palette.
   *
   * @param {React.KeyboardEvent<HTMLInputElement>} event
   */
  function handleInputKeyDown(event) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (filteredItems.length === 0) return;
      setSelectedIndex((current) => (current + 1) % filteredItems.length);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (filteredItems.length === 0) return;
      setSelectedIndex(
        (current) => (current - 1 + filteredItems.length) % filteredItems.length
      );
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      const item = filteredItems[selectedIndex];
      if (item) selectItem(item);
    }
  }

  let flatIndex = -1;

  return (
    <Dialog open={open} onClose={onOpenChange} className="relative z-50">
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-[1px] transition-opacity data-closed:opacity-0"
        aria-hidden="true"
      />

      <div className="fixed inset-0 overflow-y-auto p-4 pt-[12vh] sm:p-6 sm:pt-[14vh]">
        <DialogPanel className="border-border bg-surface mx-auto w-full max-w-xl overflow-hidden rounded-xl border shadow-2xl transition data-closed:scale-95 data-closed:opacity-0">
          <div className="border-border flex items-center gap-3 border-b px-4">
            <MagnifyingGlassIcon
              className="text-text-muted h-5 w-5 shrink-0"
              aria-hidden="true"
            />
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="Search admin pages and actions..."
              className="text-text placeholder:text-text-muted/70 w-full bg-transparent py-4 text-sm outline-none"
              role="combobox"
              aria-expanded="true"
              aria-controls={listboxId}
              aria-activedescendant={
                filteredItems[selectedIndex]
                  ? `${listboxId}-item-${selectedIndex}`
                  : undefined
              }
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>

          <div
            id={listboxId}
            role="listbox"
            aria-label="Admin navigation"
            className="max-h-[min(24rem,calc(100vh-12rem))] overflow-y-auto p-2"
          >
            {filteredItems.length === 0 ? (
              <p className="text-text-muted px-3 py-8 text-center text-sm">
                No results for &ldquo;{query}&rdquo;
              </p>
            ) : (
              groupedItems.map((group) => (
                <div key={group.label} className="mb-2 last:mb-0">
                  <p className="text-text-muted px-3 py-1.5 text-xs font-semibold tracking-wider uppercase">
                    {group.label}
                  </p>
                  <ul className="space-y-0.5">
                    {group.items.map((item) => {
                      flatIndex += 1;
                      const itemIndex = flatIndex;
                      const isSelected = itemIndex === selectedIndex;

                      return (
                        <li key={`${item.group}-${item.href}`}>
                          <button
                            id={`${listboxId}-item-${itemIndex}`}
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            onMouseEnter={() => setSelectedIndex(itemIndex)}
                            onClick={() => selectItem(item)}
                            className={clsx(
                              'group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors',
                              isSelected
                                ? 'bg-accent text-accent-fg'
                                : 'text-text hover:bg-surface-2'
                            )}
                          >
                            <item.Icon
                              className={clsx(
                                'h-5 w-5 shrink-0',
                                isSelected
                                  ? 'text-accent-fg'
                                  : 'text-text-muted group-hover:text-text'
                              )}
                              aria-hidden="true"
                            />
                            <span className="min-w-0 flex-1 truncate font-medium">
                              {item.name}
                            </span>
                            {item.external && (
                              <span
                                className={clsx(
                                  'text-xs',
                                  isSelected
                                    ? 'text-accent-fg/80'
                                    : 'text-text-muted'
                                )}
                              >
                                External
                              </span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))
            )}
          </div>

          <div className="border-border text-text-muted flex items-center justify-between gap-4 border-t px-4 py-2.5 text-xs">
            <span>Navigate with ↑↓</span>
            <span>Select with ↵</span>
            <span>Close with Esc</span>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
