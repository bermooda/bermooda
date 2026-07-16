import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { useFetcher } from 'react-router';

import {
  FieldLabel,
  RADIO_CLASS,
  SaveButton,
  SectionCard,
  inputClass,
} from '#/components/admin/settings/shared';

/**
 * Tax settings tab.
 *
 * @param {Object} props
 * @param {object} props.data
 * @returns {React.ReactElement}
 */
export function TaxTab({ data }) {
  const fetcher = useFetcher();
  const [taxMode, setTaxMode] = useState(data.taxMode);
  const [regions, setRegions] = useState(
    data.taxRegions.map((r, i) => ({ ...r, _key: i }))
  );

  function addRegion() {
    setRegions((prev) => [
      ...prev,
      { _key: Date.now(), country: '', percent: 0 },
    ]);
  }

  function removeRegion(key) {
    setRegions((prev) => prev.filter((r) => r._key !== key));
  }

  function updateRegion(key, field, value) {
    setRegions((prev) =>
      prev.map((r) => (r._key === key ? { ...r, [field]: value } : r))
    );
  }

  const regionsForSubmit = regions.map(({ country, percent }) => ({
    country,
    percent: parseFloat(percent) || 0,
  }));

  return (
    <SectionCard title="Tax Settings">
      <fetcher.Form method="post" className="space-y-6">
        <input type="hidden" name="intent" value="save-tax" />
        <input type="hidden" name="taxMode" value={taxMode} />
        <input
          type="hidden"
          name="taxRegions"
          value={JSON.stringify(regionsForSubmit)}
        />

        {/* Tax mode */}
        <div>
          <FieldLabel>Tax Mode</FieldLabel>
          <div className="mt-1 flex gap-6">
            {['inclusive', 'exclusive'].map((mode) => (
              <label
                key={mode}
                className="flex cursor-pointer items-center gap-2"
              >
                <input
                  type="radio"
                  name="taxModeRadio"
                  value={mode}
                  checked={taxMode === mode}
                  onChange={() => setTaxMode(mode)}
                  className={RADIO_CLASS}
                />
                <span className="text-text text-sm capitalize">{mode}</span>
              </label>
            ))}
          </div>
          <p className="text-text-muted mt-1 text-xs">
            {taxMode === 'inclusive'
              ? 'Prices already include tax.'
              : 'Tax is added on top of prices at checkout.'}
          </p>
        </div>

        {/* Tax regions */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <FieldLabel>Tax Regions</FieldLabel>
            <button
              type="button"
              onClick={addRegion}
              className="text-accent inline-flex items-center gap-1 text-sm hover:underline"
            >
              <PlusIcon className="h-4 w-4" />
              Add region
            </button>
          </div>

          {regions.length === 0 ? (
            <p className="text-text-muted text-sm italic">
              No tax regions configured.
            </p>
          ) : (
            <div className="space-y-2">
              {regions.map((r) => (
                <div key={r._key} className="flex items-center gap-3">
                  <input
                    type="text"
                    value={r.country}
                    onChange={(e) =>
                      updateRegion(r._key, 'country', e.target.value)
                    }
                    placeholder="Country code (e.g. US)"
                    maxLength={3}
                    className={inputClass('w-40 uppercase')}
                  />
                  <input
                    type="number"
                    value={r.percent}
                    onChange={(e) =>
                      updateRegion(r._key, 'percent', e.target.value)
                    }
                    placeholder="%"
                    min="0"
                    max="100"
                    step="0.01"
                    className={inputClass('w-24')}
                  />
                  <span className="text-text-muted text-sm">%</span>
                  <button
                    type="button"
                    onClick={() => removeRegion(r._key)}
                    className="text-text-muted hover:text-danger rounded p-1"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <SaveButton fetcher={fetcher} intent="save-tax" />
      </fetcher.Form>
    </SectionCard>
  );
}
