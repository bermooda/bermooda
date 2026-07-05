// TaxJar-style automatic tax provider (stub — uses region tables when API key absent).

import { get as settingsGet } from '#/core/settings/index.server';
import {
  computeTaxCents,
  isVatExempt,
  loadTaxConfig,
  resolveRegionRate,
} from '#/core/tax/index.server';

export const taxJarProvider = {
  id: 'taxjar',
  name: 'TaxJar (automatic)',

  async compute({ subtotalCents, shippingCents, shippingAddress, vatId }) {
    if (isVatExempt(vatId)) {
      return { taxCents: 0, rate: 0 };
    }

    const config = loadTaxConfig(
      await settingsGet('tax.mode'),
      await settingsGet('tax.regions')
    );
    let rate = resolveRegionRate(config, shippingAddress);

    if (rate === 0) {
      const country = shippingAddress?.country ?? 'US';
      if (country === 'US') rate = 0.0725;
      else if (country === 'AU') rate = 0.1;
    }

    const base = subtotalCents + shippingCents;
    const taxCents = computeTaxCents({
      baseCents: base,
      rate,
      mode: 'exclusive',
    });

    return { taxCents, rate };
  },
};
