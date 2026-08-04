import { createContext, useContext, useEffect, useState } from 'react';

/** localStorage / cookie key — kept as `theme` for backward compatibility */
const THEME_KEY = 'theme';

/**
 * @typedef {'light' | 'dark' | 'system'} ColorMode
 */

/**
 * @typedef {Object} ColorModeContextValue
 * @property {ColorMode} colorMode - The current color mode setting
 * @property {(mode: ColorMode) => void} setColorMode - Set the color mode
 * @property {() => void} toggleColorMode - Toggle between light and dark
 * @property {boolean} isDark - Whether dark mode is currently active
 */

const ColorModeContext = createContext(
  /** @type {ColorModeContextValue | null} */ (null)
);

/**
 * Get the resolved color mode based on system preference
 *
 * @param {ColorMode} colorMode - The color mode setting
 * @returns {'light' | 'dark'} The resolved color mode
 */
function getResolvedColorMode(colorMode) {
  if (colorMode === 'system') {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
    }
    return 'light';
  }
  return colorMode;
}

/**
 * Apply the dark class to the document
 *
 * @param {'light' | 'dark'} resolvedMode - The resolved color mode
 */
function applyColorModeClass(resolvedMode) {
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    if (resolvedMode === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }
}

/**
 * Color mode provider for light/dark/system UI preference
 *
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components
 * @returns {React.ReactElement} The provider component
 */
export function ColorModeProvider({ children }) {
  const [colorMode, setColorModeState] = useState(
    /** @type {ColorMode} */ ('system')
  );
  const [mounted, setMounted] = useState(false);

  // Initialize color mode from localStorage on mount and sync cookie
  useEffect(() => {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      setColorModeState(stored);
      // Sync cookie with localStorage for server-side rendering
      const resolvedMode = getResolvedColorMode(stored);
      document.cookie = `theme=${resolvedMode};path=/;max-age=31536000;SameSite=Lax`;
    }
    setMounted(true);
  }, []);

  // Apply color mode class whenever color mode changes
  useEffect(() => {
    if (!mounted) return;

    const resolvedMode = getResolvedColorMode(colorMode);
    applyColorModeClass(resolvedMode);
  }, [colorMode, mounted]);

  // Listen for system preference changes when color mode is 'system'
  useEffect(() => {
    if (!mounted || colorMode !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    /** @param {MediaQueryListEvent} e */
    const handleChange = (e) => {
      const resolvedMode = e.matches ? 'dark' : 'light';
      applyColorModeClass(resolvedMode);
      // Update cookie to match new system preference
      document.cookie = `theme=${resolvedMode};path=/;max-age=31536000;SameSite=Lax`;
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [colorMode, mounted]);

  /**
   * Set the color mode and persist to localStorage and cookie
   *
   * @param {ColorMode} newMode - The new color mode
   */
  const setColorMode = (newMode) => {
    setColorModeState(newMode);
    localStorage.setItem(THEME_KEY, newMode);

    // Also set cookie for server-side rendering
    // For 'system', we need to resolve it to light/dark for the cookie
    const resolvedMode = getResolvedColorMode(newMode);
    document.cookie = `theme=${resolvedMode};path=/;max-age=31536000;SameSite=Lax`;
  };

  /**
   * Toggle between light and dark color modes
   */
  const toggleColorMode = () => {
    const resolvedMode = getResolvedColorMode(colorMode);
    const newMode = resolvedMode === 'dark' ? 'light' : 'dark';
    setColorMode(newMode);
  };

  const isDark = mounted ? getResolvedColorMode(colorMode) === 'dark' : false;

  return (
    <ColorModeContext.Provider
      value={{ colorMode, setColorMode, toggleColorMode, isDark }}
    >
      {children}
    </ColorModeContext.Provider>
  );
}

/**
 * Hook to access the color mode context
 *
 * @returns {ColorModeContextValue} The color mode context value
 */
export default function useColorMode() {
  const context = useContext(ColorModeContext);
  if (!context) {
    throw new Error('useColorMode must be used within a ColorModeProvider');
  }
  return context;
}
