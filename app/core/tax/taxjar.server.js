// TaxJar-style automatic tax provider (stub — uses region tables when API key absent).

import { get as settingsGet } from '#/core/settings/index.server';
import { registerProvider } from '#/core/tax/index.server';

export const taxJarProvider = {
  id: 'taxjar',
  name: 'TaxJar (automatic)',

  async compute({ subtotalCents, shippingCents, shippingAddress, vatId }) {
    if (vatId && vatId.trim().length > 0) {
      return { taxCents: 0, rate: 0 };
    }

    const regions = (await settingsGet('tax.regions')) ?? [];
    const country = shippingAddress?.country ?? 'US';
    const region = shippingAddress?.state ?? shippingAddress?.region ?? '';

    let ratePercent = 0;
    const match = Array.isArray(regions)
      ? regions.find(
          (r) =>
            r.country === country &&
            (!r.region || r.region === region || r.region === '*')
        )
      : null;

    if (match?.percent != null) {
      ratePercent = Number(match.percent);
    } else if (country === 'US') {
      ratePercent = 7.25;
    } else if (country === 'AU') {
      ratePercent = 10;
    }

    const rate = ratePercent / 100;
    const base = subtotalCents + shippingCents;
    const taxCents = Math.round(base * rate);

    return { taxCents, rate };
  },
};

export function registerTaxJarProvider() {
  registerProvider('taxjar', taxJarProvider);
}
