// Carrier shipping provider — flat fallback with optional live rates via env.

import logger from '#/utils/logger.server';

import { summarizeCartLines } from '#/core/cart/lines';
import { registerProvider } from '#/core/shipping/index.server';

const CARRIER_RATES = {
  domestic: { standard: 599, express: 1299 },
  international: { standard: 1499, express: 2999 },
};

export const carrierProvider = {
  id: 'carrier',
  name: 'Carrier rates (UPS/FedEx-style)',

  async getQuotes({ shippingAddress, cart }) {
    const country = shippingAddress?.country ?? 'US';
    const isDomestic = country === 'US';
    const zone = isDomestic ? 'domestic' : 'international';
    const { subtotalCents } = summarizeCartLines(cart.lines);

    const useLiveRates =
      process.env.CARRIER_LIVE_RATES === 'true' &&
      Boolean(process.env.CARRIER_API_KEY);

    if (!useLiveRates) {
      return [
        {
          id: `${zone}-standard`,
          name: isDomestic ? 'Standard shipping' : 'International standard',
          rateCents: CARRIER_RATES[zone].standard,
          estimatedDays: isDomestic ? 5 : 10,
        },
        {
          id: `${zone}-express`,
          name: isDomestic ? 'Express shipping' : 'International express',
          rateCents: CARRIER_RATES[zone].express,
          estimatedDays: isDomestic ? 2 : 5,
        },
      ];
    }

    // Placeholder for carrier API integration — returns computed estimates.
    logger.info(
      { country, subtotalCents },
      'Carrier live rates requested (stub)'
    );

    const weightFactor = Math.max(1, cart.lines.length);
    return [
      {
        id: `${zone}-carrier-standard`,
        name: 'Carrier standard',
        rateCents: CARRIER_RATES[zone].standard + weightFactor * 100,
        estimatedDays: isDomestic ? 4 : 8,
      },
    ];
  },
};

export function registerCarrierProvider() {
  registerProvider('carrier', carrierProvider);
}
