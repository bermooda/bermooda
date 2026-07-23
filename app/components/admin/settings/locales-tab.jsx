import { useState } from 'react';
import { useFetcher } from 'react-router';

import { LOCALE_OPTIONS } from '#/core/i18n';
import {
  CHECKBOX_CLASS,
  RADIO_CLASS,
  SaveButton,
  SectionCard,
} from '#/components/admin/settings/shared';
import Table, { TBody, Td, Th, THead } from '#/components/admin/table';

/**
 * Locales settings tab.
 *
 * @param {Object} props
 * @param {object} props.data
 * @returns {React.ReactElement}
 */
export function LocalesTab({ data }) {
  const fetcher = useFetcher();
  const [enabled, setEnabled] = useState(data.locales);
  const [defaultLocale, setDefaultLocale] = useState(data.defaultLocale);

  function toggle(l) {
    setEnabled((prev) =>
      prev.includes(l) ? prev.filter((x) => x !== l) : [...prev, l]
    );
  }

  return (
    <SectionCard title="Locales">
      <fetcher.Form method="post" className="space-y-4">
        <input type="hidden" name="intent" value="save-locales" />
        {enabled.map((l) => (
          <input key={l} type="hidden" name="locales" value={l} />
        ))}
        <input type="hidden" name="defaultLocale" value={defaultLocale} />

        <p className="text-text-muted text-sm">
          Enable locales for your storefront. The default locale is used when no
          locale is detected.
        </p>

        <Table>
          <THead>
            <tr>
              <Th>Locale</Th>
              <Th className="text-center">Enabled</Th>
              <Th className="text-center">Default</Th>
            </tr>
          </THead>
          <TBody>
            {LOCALE_OPTIONS.map((l) => {
              const isEnabled = enabled.includes(l);
              const isDefault = defaultLocale === l;
              return (
                <tr key={l}>
                  <Td className="text-text font-mono font-semibold">{l}</Td>
                  <Td className="text-center">
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={() => toggle(l)}
                      className={CHECKBOX_CLASS}
                    />
                  </Td>
                  <Td className="text-center">
                    <input
                      type="radio"
                      checked={isDefault}
                      disabled={!isEnabled}
                      onChange={() => setDefaultLocale(l)}
                      className={clsx(RADIO_CLASS, 'disabled:opacity-40')}
                    />
                  </Td>
                </tr>
              );
            })}
          </TBody>
        </Table>

        <SaveButton fetcher={fetcher} intent="save-locales" />
      </fetcher.Form>
    </SectionCard>
  );
}
