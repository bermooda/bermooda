import { createContext, useContext, useEffect, useState } from 'react';

const THEME_KEY = 'theme';

/**
 * @typedef {'light' | 'dark' | 'system'} Theme
 */

/**
 * @typedef {Object} ThemeContextValue
 * @property {Theme} theme - The current theme setting
 * @property {(theme: Theme) => void} setTheme - Set the theme
 * @property {() => void} toggleTheme - Toggle between light and dark
 * @property {boolean} isDark - Whether dark mode is currently active
 */

/** @type {React.Context<ThemeContextValue | null>} */
const ThemeContext = createContext(null);

/**
 * Get the resolved theme based on system preference
 *
 * @param {Theme} theme - The theme setting
 * @returns {'light' | 'dark'} The resolved theme
 */
function getResolvedTheme(theme) {
  if (theme === 'system') {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
    }
    return 'light';
  }
  return theme;
}

/**
 * Apply the theme class to the document
 *
 * @param {'light' | 'dark'} resolvedTheme - The resolved theme
 */
function applyThemeClass(resolvedTheme) {
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    if (resolvedTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }
}

/**
 * Theme Provider Component
 *
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components
 * @returns {React.ReactElement} The provider component
 */
export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(/** @type {Theme} */ ('system'));
  const [mounted, setMounted] = useState(false);

  // Initialize theme from localStorage on mount and sync cookie
  useEffect(() => {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      setThemeState(stored);
      // Sync cookie with localStorage for server-side rendering
      const resolvedTheme = getResolvedTheme(stored);
      document.cookie = `theme=${resolvedTheme};path=/;max-age=31536000;SameSite=Lax`;
    }
    setMounted(true);
  }, []);

  // Apply theme class whenever theme changes
  useEffect(() => {
    if (!mounted) return;

    const resolvedTheme = getResolvedTheme(theme);
    applyThemeClass(resolvedTheme);
  }, [theme, mounted]);

  // Listen for system preference changes when theme is 'system'
  useEffect(() => {
    if (!mounted || theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (e) => {
      const resolvedTheme = e.matches ? 'dark' : 'light';
      applyThemeClass(resolvedTheme);
      // Update cookie to match new system preference
      document.cookie = `theme=${resolvedTheme};path=/;max-age=31536000;SameSite=Lax`;
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme, mounted]);

  /**
   * Set the theme and persist to localStorage and cookie
   *
   * @param {Theme} newTheme - The new theme
   */
  const setTheme = (newTheme) => {
    setThemeState(newTheme);
    localStorage.setItem(THEME_KEY, newTheme);

    // Also set cookie for server-side rendering
    // For 'system', we need to resolve it to light/dark for the cookie
    const resolvedTheme = getResolvedTheme(newTheme);
    document.cookie = `theme=${resolvedTheme};path=/;max-age=31536000;SameSite=Lax`;
  };

  /**
   * Toggle between light and dark themes
   */
  const toggleTheme = () => {
    const resolvedTheme = getResolvedTheme(theme);
    const newTheme = resolvedTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
  };

  const isDark = mounted ? getResolvedTheme(theme) === 'dark' : false;

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Hook to access the theme context
 *
 * @returns {ThemeContextValue} The theme context value
 */
export default function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
