import { useEffect, useState } from 'react';

/**
 * Returns `false` on the server and for the first client render, then `true`.
 * Useful for entrance transitions that must not run during hydration.
 *
 * @returns {boolean}
 */
export default function useMounted() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return mounted;
}
