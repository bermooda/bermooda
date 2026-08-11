import { useEffect, useRef, useState } from 'react';
import { useFetcher } from 'react-router';

import Combobox from '#/components/admin/form/combobox';

const SEARCH_DEBOUNCE_MS = 250;
const SEARCH_LIMIT = 20;

/**
 * @typedef {{ id: string, email: string, name?: string | null }} CustomerOptionSource
 * @typedef {{ id: string, label: string, description?: string }} ComboboxOptionItem
 */

/**
 * @param {CustomerOptionSource} customer
 * @returns {ComboboxOptionItem}
 */
function toOption(customer) {
  const email = customer.email ?? '';
  const name = customer.name?.trim() || '';
  if (name && name !== email) {
    return { id: customer.id, label: name, description: email };
  }
  return { id: customer.id, label: email || customer.id };
}

/**
 * Customer picker with lazy-loaded search results (admin session).
 *
 * @param {Object} props
 * @param {string} props.id
 * @param {string} [props.name]
 * @param {string[]} [props.excludeIds] Customer ids already members (hidden from results)
 * @param {string} [props.placeholder]
 * @param {string} [props.emptyMessage]
 * @param {string} [props.loadingMessage]
 * @param {boolean} [props.disabled]
 * @param {string} [props.className]
 * @param {(value: ComboboxOptionItem | null) => void} [props.onChange]
 * @returns {React.ReactElement}
 */
export default function CustomerMemberCombobox({
  id,
  name = 'customerId',
  excludeIds = [],
  placeholder = '',
  emptyMessage = 'No customers found',
  loadingMessage = 'Searching…',
  disabled = false,
  className = '',
  onChange,
}) {
  const fetcher = useFetcher();
  const loadRef = useRef(fetcher.load);
  loadRef.current = fetcher.load;

  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(
    /** @type {ComboboxOptionItem | null} */ (null)
  );
  const [hasOpened, setHasOpened] = useState(false);
  const [searchPending, setSearchPending] = useState(false);
  const excludeKey = excludeIds.filter(Boolean).slice().sort().join(',');

  useEffect(() => {
    if (!hasOpened) return undefined;

    setSearchPending(true);
    const handle = window.setTimeout(() => {
      const params = new URLSearchParams();
      params.set('limit', String(SEARCH_LIMIT));
      if (query.trim()) params.set('q', query.trim());
      for (const excludeId of excludeKey.split(',')) {
        if (excludeId) params.append('exclude', excludeId);
      }
      loadRef.current(`/admin/customers/search?${params.toString()}`);
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(handle);
    };
  }, [query, hasOpened, excludeKey]);

  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data !== undefined) {
      setSearchPending(false);
    }
  }, [fetcher.state, fetcher.data]);

  const customers = Array.isArray(fetcher.data?.customers)
    ? fetcher.data.customers
    : [];
  const options = customers.map(toOption);
  const loading = hasOpened && (searchPending || fetcher.state === 'loading');

  /**
   * @param {ComboboxOptionItem | null} next
   */
  function handleChange(next) {
    setSelected(next);
    onChange?.(next);
  }

  return (
    <Combobox
      id={id}
      name={name}
      value={selected}
      onChange={handleChange}
      onQueryChange={setQuery}
      options={options}
      placeholder={placeholder}
      disabled={disabled}
      loading={loading}
      emptyMessage={emptyMessage}
      loadingMessage={loadingMessage}
      className={className}
      onOpen={() => setHasOpened(true)}
    />
  );
}
