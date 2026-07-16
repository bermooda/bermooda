import { useState } from 'react';
import { useFetcher } from 'react-router';

import { AVAILABLE_CURRENCIES } from '#/core/settings/defaults';
import {
  CHECKBOX_CLASS,
  RADIO_CLASS,
  SaveButton,
  SectionCard,
} from '#/components/admin/settings/shared';
import Table, { TBody, Td, Th, THead } from '#/components/admin/table';

/**
 * Currencies settings tab.
 *
 * @param {Object} props
 * @param {object} props.data
 * @returns {React.ReactElement}
 */
export function CurrenciesTab({ data }) {
  const fetcher = useFetcher();
  const [enabled, setEnabled] = useState(data.currencies);
  const [defaultCurrency, setDefaultCurrency] = useState(data.defaultCurrency);

  function toggle(c) {
    setEnabled((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    );
  }

  return (
    <SectionCard title="Currencies">
      <fetcher.Form method="post" className="space-y-4">
        <input type="hidden" name="intent" value="save-currencies" />
        {enabled.map((c) => (
          <input key={c} type="hidden" name="currencies" value={c} />
        ))}
        <input type="hidden" name="defaultCurrency" value={defaultCurrency} />

        <p className="text-text-muted text-sm">
          Enable or disable currencies. The default is used as the primary
          storefront currency.
        </p>

        <Table>
          <THead>
            <tr>
              <Th>Currency</Th>
              <Th className="text-center">Enabled</Th>
              <Th className="text-center">Default</Th>
            </tr>
          </THead>
          <TBody>
            {AVAILABLE_CURRENCIES.map((c) => {
              const isEnabled = enabled.includes(c);
              const isDefault = defaultCurrency === c;
              return (
                <tr key={c}>
                  <Td className="text-text font-mono font-semibold">{c}</Td>
                  <Td className="text-center">
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={() => toggle(c)}
                      className={CHECKBOX_CLASS}
                    />
                  </Td>
                  <Td className="text-center">
                    <input
                      type="radio"
                      checked={isDefault}
                      disabled={!isEnabled}
                      onChange={() => setDefaultCurrency(c)}
                      className={clsx(RADIO_CLASS, 'disabled:opacity-40')}
                    />
                  </Td>
                </tr>
              );
            })}
          </TBody>
        </Table>

        <SaveButton fetcher={fetcher} intent="save-currencies" />
      </fetcher.Form>
    </SectionCard>
  );
}
