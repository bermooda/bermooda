import clsx from 'clsx';
import { useState } from 'react';
import { useFetcher } from 'react-router';

import { LOCALE_OPTIONS, useT } from '#/core/i18n';
import {
  CHECKBOX_CLASS,
  RADIO_CLASS,
  SaveButton,
} from '#/components/admin/settings/shared';
import Table, { TBody, Td, Th, THead, Tr } from '#/components/admin/table';

/**
 * Locales settings tab.
 *
 * @param {Object} props
 * @param {object} props.data
 * @returns {React.ReactElement}
 */
export function LocalesTab({ data }) {
  const t = useT();
  const fetcher = useFetcher();
  const [enabled, setEnabled] = useState(data.locales);
  const [defaultLocale, setDefaultLocale] = useState(data.defaultLocale);

  /**
   * @param {string} l
   */
  function toggle(l) {
    setEnabled((prev) =>
      prev.includes(l) ? prev.filter((x) => x !== l) : [...prev, l]
    );
  }

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-text text-base font-semibold">
          {t('admin.settings.locales.title')}
        </h2>
        <p className="text-text-muted mt-1 text-sm">
          {t('admin.settings.locales.help')}
        </p>
      </div>

      <fetcher.Form method="post" className="space-y-6">
        <input type="hidden" name="intent" value="save-locales" />
        {enabled.map((l) => (
          <input key={l} type="hidden" name="locales" value={l} />
        ))}
        <input type="hidden" name="defaultLocale" value={defaultLocale} />

        <Table variant="sticky" className="mt-2">
          <THead sticky>
            <tr>
              <Th sticky className="py-3.5 pr-3 pl-1 sm:pl-0">
                {t('admin.settings.locales.col.locale')}
              </Th>
              <Th sticky className="px-3 py-3.5 text-center">
                {t('admin.settings.locales.col.enabled')}
              </Th>
              <Th sticky className="px-3 py-3.5 text-center">
                {t('admin.settings.locales.col.default')}
              </Th>
            </tr>
          </THead>
          <TBody sticky>
            {LOCALE_OPTIONS.map((l) => {
              const isEnabled = enabled.includes(l);
              const isDefault = defaultLocale === l;
              return (
                <Tr key={l}>
                  <Td
                    sticky
                    className="text-text py-4 pr-3 pl-1 font-medium whitespace-normal sm:pl-0"
                  >
                    <span className="block truncate font-mono font-medium">
                      {l}
                    </span>
                  </Td>
                  <Td sticky className="px-3 py-4 text-center">
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={() => toggle(l)}
                      className={CHECKBOX_CLASS}
                      aria-label={t('admin.settings.locales.col.enabled')}
                    />
                  </Td>
                  <Td sticky className="px-3 py-4 text-center">
                    <input
                      type="radio"
                      checked={isDefault}
                      disabled={!isEnabled}
                      onChange={() => setDefaultLocale(l)}
                      className={clsx(RADIO_CLASS, 'disabled:opacity-40')}
                      aria-label={t('admin.settings.locales.col.default')}
                    />
                  </Td>
                </Tr>
              );
            })}
          </TBody>
        </Table>

        <SaveButton fetcher={fetcher} intent="save-locales" />
      </fetcher.Form>
    </div>
  );
}
