import { useCallback, useEffect, useState } from 'react';

/**
 * Global command palette open state with Cmd/Ctrl+K toggle.
 *
 * @returns {{ open: boolean, setOpen: (open: boolean) => void, openPalette: () => void, closePalette: () => void }}
 */
export default function useCommandPalette() {
  const [open, setOpen] = useState(false);

  const openPalette = useCallback(() => setOpen(true), []);
  const closePalette = useCallback(() => setOpen(false), []);

  useEffect(() => {
    function onKeyDown(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((current) => !current);
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  return { open, setOpen, openPalette, closePalette };
}

/**
 * Keyboard shortcut label for the current platform.
 *
 * @returns {'⌘K' | 'Ctrl+K'}
 */
export function getCommandPaletteShortcutLabel() {
  if (typeof navigator === 'undefined') return 'Ctrl+K';

  const platform = navigator.platform ?? '';
  const userAgent = navigator.userAgent ?? '';
  const isApple =
    /Mac|iPhone|iPad|iPod/.test(platform) || /Mac OS X/.test(userAgent);

  return isApple ? '⌘K' : 'Ctrl+K';
}
