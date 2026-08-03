// app/core/plugins/providers.server.js
// Provider type table + register/unregister wiring for plugins.

import {
  getActiveProviderId as getActiveEmailProviderId,
  registerProvider as registerEmailProvider,
  setActiveProvider as setActiveEmailProvider,
  unregisterProvider as unregisterEmailProvider,
} from '#/libs/email/index.server';
import {
  registerProvider as registerAddressValidationProvider,
  unregisterProvider as unregisterAddressValidationProvider,
} from '#/core/address-validation/index.server';
import {
  registerProvider as registerPaymentProvider,
  unregisterProvider as unregisterPaymentProvider,
} from '#/core/payments/index.server';
import { defineProviders } from '#/core/plugins/define.server';
import {
  getDefaultProviderId as getDefaultSearchProviderId,
  registerProvider as registerSearchProvider,
  setDefaultProvider as setDefaultSearchProvider,
  unregisterProvider as unregisterSearchProvider,
} from '#/core/search/index.server';
import {
  registerProvider as registerShippingProvider,
  unregisterProvider as unregisterShippingProvider,
} from '#/core/shipping/index.server';
import {
  registerProvider as registerTaxProvider,
  unregisterProvider as unregisterTaxProvider,
} from '#/core/tax/index.server';

/**
 * @typedef {{ type: string, id: string, previousDefaultId?: string | null }} WiredProvider
 */

/**
 * @typedef {{
 *   manifest: { providers?: Record<string, { type: string } & Object> },
 *   providers: WiredProvider[],
 * }} PluginProviderEntry
 */

/**
 * Dispatch table for plugin provider types.
 * `exclusive` marks types that should only be active on one plugin at a time
 * (enforced in lifecycle enable-state, not here).
 *
 * @type {Record<string, {
 *   register: (id: string, spec: object, entry: PluginProviderEntry) => void,
 *   unregister: (id: string, provider: WiredProvider, entry: PluginProviderEntry) => void,
 *   exclusive?: boolean,
 * }>}
 */
export const PROVIDER_TYPE_HANDLERS = {
  payment: {
    register: (id, spec, entry) => {
      registerPaymentProvider(id, spec);
      entry.providers.push({ type: 'payment', id });
    },
    unregister: (id) => {
      unregisterPaymentProvider(id);
    },
  },
  shipping: {
    register: (id, spec, entry) => {
      registerShippingProvider(id, spec);
      entry.providers.push({ type: 'shipping', id });
    },
    unregister: (id) => {
      unregisterShippingProvider(id);
    },
  },
  tax: {
    register: (id, spec, entry) => {
      registerTaxProvider(id, spec);
      entry.providers.push({ type: 'tax', id });
    },
    unregister: (id) => {
      unregisterTaxProvider(id);
    },
  },
  search: {
    register: (id, spec, entry) => {
      const previousDefaultId = spec.isDefault
        ? getDefaultSearchProviderId()
        : null;
      registerSearchProvider(id, spec.provider, { isDefault: spec.isDefault });
      entry.providers.push({ type: 'search', id, previousDefaultId });
    },
    unregister: (id, provider) => {
      unregisterSearchProvider(id);
      if (provider.previousDefaultId && provider.previousDefaultId !== id) {
        setDefaultSearchProvider(provider.previousDefaultId);
      }
    },
  },
  address_validation: {
    register: (id, spec, entry) => {
      registerAddressValidationProvider(id, spec);
      entry.providers.push({ type: 'address_validation', id });
    },
    unregister: (id) => {
      unregisterAddressValidationProvider(id);
    },
  },
  email: {
    register: (id, spec, entry) => {
      const previousActiveId = getActiveEmailProviderId();
      registerEmailProvider(id, spec, { isActive: true });
      entry.providers.push({
        type: 'email',
        id,
        previousDefaultId: previousActiveId,
      });
    },
    unregister: (id, provider) => {
      unregisterEmailProvider(id);
      if (provider.previousDefaultId && provider.previousDefaultId !== id) {
        try {
          setActiveEmailProvider(provider.previousDefaultId);
        } catch {
          // Previous provider may have been unregistered already.
        }
      }
    },
    exclusive: true,
  },
};

/**
 * Registers all providers declared on a plugin entry.
 *
 * @param {PluginProviderEntry} entry
 * @returns {void}
 */
export function registerProvidersForPlugin(entry) {
  const providerMap = entry.manifest.providers;
  if (!providerMap) return;

  for (const [providerId, spec] of Object.entries(
    defineProviders(providerMap)
  )) {
    const { type, ...providerSpec } = spec;
    const handler = PROVIDER_TYPE_HANDLERS[type];
    if (!handler) {
      throw new Error(`Unsupported provider type "${type}"`);
    }
    handler.register(providerId, providerSpec, entry);
  }
}

/**
 * Unregisters providers previously wired for a plugin entry (LIFO).
 *
 * @param {PluginProviderEntry} entry
 * @returns {void}
 */
export function unregisterProvidersForPlugin(entry) {
  for (const provider of [...entry.providers].reverse()) {
    const handler = PROVIDER_TYPE_HANDLERS[provider.type];
    if (!handler) continue;
    handler.unregister(provider.id, provider, entry);
  }

  entry.providers = [];
}
