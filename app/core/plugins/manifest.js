// Shared plugin manifest constants (client-safe).

/** Required top-level fields in a plugin manifest. */
export const REQUIRED_MANIFEST_FIELDS = ['id', 'title', 'version', 'slug'];

/** Provider types that plugins may register. */
export const VALID_PROVIDER_TYPES = ['payment', 'shipping', 'tax', 'search'];
