// app/core/config/port.js
// Port helpers shared by Vite config and runtime app config.
// Keep this module free of bermooda.config / createConfig side effects so
// vite.config.js can import it during production builds.

// Relative, extension-bearing import on purpose: vite.config.js loads this
// module directly, before the `#/*` alias it defines exists.
import { readEnv } from './env.js';

/** Default local dev server port (shared with Vite `server.port`). */
export const DEFAULT_DEV_PORT = 3000;

/**
 * Resolve the local dev server port.
 *
 * Prefers `options.port`, then `process.env.PORT`, then {@link DEFAULT_DEV_PORT}.
 *
 * @param {{ port?: string | number | null }} [options]
 * @returns {number}
 */
export function resolveDevPort(options = {}) {
  const raw = options.port ?? readEnv('PORT');
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
