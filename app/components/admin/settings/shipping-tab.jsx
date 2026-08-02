import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { useFetcher } from 'react-router';

import { useT } from '#/core/i18n';
import {
  SaveButton,
  SectionCard,
  inputClass,
} from '#/components/admin/settings/shared';

/**
 * Shipping zones settings tab.
 *
 * @param {Object} props
 * @param {object} props.data
 * @returns {React.ReactElement}
 */
export function ShippingTab({ data }) {
  const t = useT();
  const fetcher = useFetcher();
  const [zones, setZones] = useState(
    data.shippingZones.map((z, i) => ({
      ...z,
      name: z.name ?? z.label ?? '',
      id: z.id ?? null,
      _key: i,
    }))
  );

  function addZone() {
    setZones((prev) => [
      ...prev,
      {
        _key: Date.now(),
        name: '',
        countries: '',
        rateCents: 0,
        freeOverCents: '',
      },
    ]);
  }

  function removeZone(key) {
    setZones((prev) => prev.filter((z) => z._key !== key));
  }

  function updateZone(key, field, value) {
    setZones((prev) =>
      prev.map((z) => (z._key === key ? { ...z, [field]: value } : z))
    );
  }

  const zonesForSubmit = zones.map(
    (
      { id, name, countries, rateCents, freeOverCents, estimatedDays },
      index
    ) => {
      const trimmedName = name?.trim() ?? '';
      const slug =
        trimmedName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_|_$/g, '') || `zone_${index}`;

      return {
        id: id || slug,
        name: trimmedName,
        countries:
          typeof countries === 'string'
            ? countries
            : Array.isArray(countries)
              ? countries.join(', ')
              : '',
        rateCents,
        freeOverCents,
        estimatedDays,
      };
    }
  );

  return (
    <SectionCard title={t('admin.settings.shipping.title')}>
      <fetcher.Form method="post" className="space-y-6">
        <input type="hidden" name="intent" value="save-shipping" />
        <input
          type="hidden"
          name="shippingZones"
          value={JSON.stringify(zonesForSubmit)}
        />

        <p className="text-text-muted text-sm">
          {t('admin.settings.shipping.help')}
        </p>

        <div className="flex items-center justify-between">
          <span className="text-text text-sm font-medium">
            {zones.length === 1
              ? t('admin.settings.shipping.zonesCountOne', {
                  count: zones.length,
                })
              : t('admin.settings.shipping.zonesCount', {
                  count: zones.length,
                })}
          </span>
          <button
            type="button"
            onClick={addZone}
            className="text-accent inline-flex items-center gap-1 text-sm hover:underline"
          >
            <PlusIcon className="h-4 w-4" />
            {t('admin.settings.shipping.addZone')}
          </button>
        </div>

        {zones.length === 0 ? (
          <p className="text-text-muted text-sm italic">
            {t('admin.settings.shipping.empty')}
          </p>
        ) : (
          <div className="space-y-3">
            {zones.map((z) => {
              const countriesStr =
                typeof z.countries === 'string'
                  ? z.countries
                  : Array.isArray(z.countries)
                    ? z.countries.join(', ')
                    : '';
              return (
                <div
                  key={z._key}
                  className="border-border space-y-3 rounded-lg border p-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-text text-sm font-medium">
                      {t('admin.settings.shipping.zoneLabel')}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeZone(z._key)}
                      className="text-text-muted hover:text-danger rounded p-1"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="text-text-muted mb-1 block text-xs font-medium">
                        {t('admin.settings.shipping.zoneName')}
                      </label>
                      <input
                        type="text"
                        value={z.name}
                        onChange={(e) =>
                          updateZone(z._key, 'name', e.target.value)
                        }
                        placeholder={t(
                          'admin.settings.shipping.zoneNamePlaceholder'
                        )}
                        className={inputClass()}
                      />
                    </div>
                    <div>
                      <label className="text-text-muted mb-1 block text-xs font-medium">
                        {t('admin.settings.shipping.countries')}
                      </label>
                      <input
                        type="text"
                        value={countriesStr}
                        onChange={(e) =>
                          updateZone(z._key, 'countries', e.target.value)
                        }
                        placeholder={t(
                          'admin.settings.shipping.countriesPlaceholder'
                        )}
                        className={inputClass('uppercase')}
                      />
                    </div>
                    <div>
                      <label className="text-text-muted mb-1 block text-xs font-medium">
                        {t('admin.settings.shipping.rate')}
                      </label>
                      <input
                        type="number"
                        value={z.rateCents}
                        onChange={(e) =>
                          updateZone(z._key, 'rateCents', e.target.value)
                        }
                        placeholder={t(
                          'admin.settings.shipping.ratePlaceholder'
                        )}
                        min="0"
                        className={inputClass()}
                      />
                    </div>
                    <div>
                      <label className="text-text-muted mb-1 block text-xs font-medium">
                        {t('admin.settings.shipping.freeOver')}
                      </label>
                      <input
                        type="number"
                        value={z.freeOverCents ?? ''}
                        onChange={(e) =>
                          updateZone(z._key, 'freeOverCents', e.target.value)
                        }
                        placeholder={t(
                          'admin.settings.shipping.freeOverPlaceholder'
                        )}
                        min="0"
                        className={inputClass()}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <SaveButton fetcher={fetcher} intent="save-shipping" />
      </fetcher.Form>
    </SectionCard>
  );
}
