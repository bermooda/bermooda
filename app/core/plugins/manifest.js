// Shared plugin manifest constants (client-safe).

/** Required top-level fields in a plugin manifest. */
export const REQUIRED_MANIFEST_FIELDS = ['id', 'name', 'version'];

/** Provider types that plugins may register. */
export const VALID_PROVIDER_TYPES = ['payment', 'shipping', 'tax', 'search'];
