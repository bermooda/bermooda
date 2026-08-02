// app/core/address-validation/input.js
// Pure address-validation settings parsing — no settings/registry imports.

export const DEFAULT_ADDRESS_VALIDATION_PROVIDER = 'noop';

/**
 * Parse admin/API address validation settings payload.
 *
 * @param {{ provider?: string, addressValidationProvider?: string }} [input]
 * @returns {{ provider: string }}
 */
export function parseAddressValidationSettingsInput(input = {}) {
  const provider = String(
    input.provider ?? input.addressValidationProvider ?? ''
  ).trim();
  return {
    provider: provider || DEFAULT_ADDRESS_VALIDATION_PROVIDER,
  };
}
