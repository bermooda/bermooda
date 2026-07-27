// app/core/config/port.js
// Port helpers shared by Vite config and runtime app config.
// Keep this module free of bermooda.config / createConfig side effects so
// vite.config.js can import it during production builds.

/** Default local dev server port (shared with Vite `server.port`). */
export const DEFAULT_DEV_PORT = 3000;

/**
 * Resolve the local dev server port.
 *
 * Prefers `options.port`, then `process.env.PORT`, then {@link DEFAULT_DEV_PORT}.
 * `process` is guarded so this module is safe to import in the browser
 * (Vite does not polyfill `process.env.PORT`).
 *
 * @param {{ port?: string | number | null }} [options]
 * @returns {number}
 */
export function resolveDevPort(options = {}) {
  const envPort =
    typeof process !== 'undefined' && process.env
      ? process.env.PORT
      : undefined;
  const raw = options.port ?? envPort;
  const n =
    typeof raw === 'number'
      ? raw
      : typeof raw === 'string' && raw.trim() !== ''
        ? Number(raw.trim())
        : NaN;

  if (Number.isInteger(n) && n > 0 && n <= 65535) {
    return n;
  }

  return DEFAULT_DEV_PORT;
}
