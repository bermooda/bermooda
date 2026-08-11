import {
  Combobox as HeadlessCombobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
} from '@headlessui/react';
import { CheckIcon, ChevronUpDownIcon } from '@heroicons/react/20/solid';
import clsx from 'clsx';

import { controlClasses } from '#/components/admin/form/input';

/**
 * @typedef {Object} ComboboxOptionItem
 * @property {string} id
 * @property {string} label
 * @property {string} [description]
 */

/**
 * Admin combobox (Tailwind UI “Simple” pattern) with semantic tokens.
 *
 * @param {Object} props
 * @param {string} [props.id]
 * @param {string} [props.name] Hidden input name when a selection is made
 * @param {ComboboxOptionItem | null} [props.value]
 * @param {(value: ComboboxOptionItem | null) => void} props.onChange
 * @param {(query: string) => void} props.onQueryChange
 * @param {ComboboxOptionItem[]} props.options
 * @param {string} [props.placeholder]
 * @param {boolean} [props.disabled]
 * @param {boolean} [props.loading]
 * @param {string} [props.emptyMessage]
 * @param {string} [props.loadingMessage]
 * @param {string} [props.className]
 * @param {() => void} [props.onOpen]
 * @returns {React.ReactElement}
 */
export default function Combobox({
  id,
  name,
  value = null,
  onChange,
  onQueryChange,
  options,
  placeholder = '',
  disabled = false,
  loading = false,
  emptyMessage = 'No results',
  loadingMessage = 'Searching…',
  className = '',
  onOpen,
}) {
  const showEmpty = !loading && options.length === 0;
  const showOptions = options.length > 0;

  return (
    <HeadlessCombobox
      as="div"
      className={clsx('relative', className)}
      value={value}
      disabled={disabled}
      by="id"
      onChange={(next) => {
        onQueryChange('');
        onChange(next);
      }}
      onClose={() => onQueryChange('')}
    >
      {name ? (
        <input type="hidden" name={name} value={value?.id ?? ''} />
      ) : null}
      <div className="relative">
        <ComboboxInput
          id={id}
          className={clsx(controlClasses, 'pr-10')}
          displayValue={(item) => item?.label ?? ''}
          onChange={(event) => onQueryChange(event.target.value)}
          onFocus={() => onOpen?.()}
          onClick={() => onOpen?.()}
          placeholder={placeholder}
          autoComplete="off"
        />
        <ComboboxButton
          className="absolute inset-y-0 right-0 flex items-center rounded-r-md px-2 focus:outline-hidden"
          onClick={() => onOpen?.()}
        >
          <ChevronUpDownIcon
            className="text-text-muted size-5"
            aria-hidden="true"
          />
        </ComboboxButton>

        {(loading || showEmpty || showOptions) && (
          <ComboboxOptions className="border-border bg-surface absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border py-1 text-sm shadow-lg outline-none">
            {loading && !showOptions ? (
              <div className="text-text-muted px-3 py-2">{loadingMessage}</div>
            ) : null}
            {showEmpty ? (
              <div className="text-text-muted px-3 py-2">{emptyMessage}</div>
            ) : null}
            {showOptions
              ? options.map((option) => (
                  <ComboboxOption
                    key={option.id}
                    value={option}
                    className="text-text data-focus:bg-accent data-focus:text-accent-fg group relative cursor-default py-2 pr-9 pl-3 select-none data-focus:outline-hidden"
                  >
                    <span className="block truncate group-data-selected:font-semibold">
                      {option.label}
                    </span>
                    {option.description ? (
                      <span className="text-text-muted group-data-focus:text-accent-fg/80 block truncate text-xs">
                        {option.description}
                      </span>
                    ) : null}
                    <span className="text-accent group-data-focus:text-accent-fg absolute inset-y-0 right-0 hidden items-center pr-4 group-data-selected:flex">
                      <CheckIcon className="size-5" aria-hidden="true" />
                    </span>
                  </ComboboxOption>
                ))
              : null}
          </ComboboxOptions>
        )}
      </div>
    </HeadlessCombobox>
  );
}
