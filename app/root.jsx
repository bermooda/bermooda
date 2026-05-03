import clsx from 'clsx';
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useMatches,
} from 'react-router';

import { getThemeFromRequest } from '#/utils/theme.server';
import { ThemeProvider } from '#/hooks/use-theme';

// @ts-ignore
import '#/styles/app.css';

/**
 * Root loader to get theme from cookie
 *
 * @param {Object} args - Loader arguments
 * @param {Request} args.request - The incoming request
 * @returns {{ theme: 'light' | 'dark' | null }} The theme data
 */
export function loader({ request }) {
  const theme = getThemeFromRequest(request);
  return { theme };
}

export const links = () => [
  { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
  { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
  {
    rel: 'preconnect',
    href: 'https://fonts.gstatic.com',
    crossOrigin: 'anonymous',
  },
  {
    rel: 'stylesheet',
    href: 'https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap',
  },
];

/**
 * Layout component for the app
 *
 * @param {Object} props - The component props
 * @param {React.ReactNode} props.children - The child components
 * @returns {React.ReactNode} The layout component
 */
export function Layout({ children }) {
  /** @type {Array<import('react-router').UIMatch>} */
  const matches = useMatches();

  // Get the theme from the root loader via matches (first match is root)
  const rootMatch = matches.find((match) => match.id === 'root');
  const serverTheme = rootMatch?.data?.theme;

  // Collect classes from all matched routes' handles
  const htmlClasses = matches
    .filter((match) => match.handle?.htmlClass)
    .map((match) => match.handle.htmlClass)
    .join(' ');

  const bodyClasses = matches
    .filter((match) => match.handle?.bodyClass)
    .map((match) => match.handle.bodyClass)
    .join(' ');

  return (
    <html
      lang="en"
      className={clsx(
        'dark:bg-dark-950 dark:text-dark-300 text-zinc-950 antialiased md:bg-zinc-100',
        htmlClasses,
        serverTheme === 'dark' && 'dark'
      )}
    >
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var cl = document.documentElement.classList;
                  var theme = localStorage.getItem('theme');
                  var serverTheme = cl.contains('dark') ? 'dark' : 'light';
                  var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  var resolvedTheme = theme === 'dark' ? 'dark' 
                    : theme === 'light' ? 'light' 
                    : (prefersDark ? 'dark' : 'light');
                  
                  // Only update if server and client theme differ
                  if (resolvedTheme === 'dark' && serverTheme !== 'dark') {
                    cl.add('dark');
                  } else if (resolvedTheme === 'light' && serverTheme === 'dark') {
                    cl.remove('dark');
                  }
                  
                  // Sync cookie with localStorage for next server render
                  var currentCookie = document.cookie.match(/(?:^|; )theme=([^;]*)/);
                  var cookieTheme = currentCookie ? currentCookie[1] : null;
                  if (theme && theme !== 'system' && cookieTheme !== theme) {
                    document.cookie = 'theme=' + theme + ';path=/;max-age=31536000;SameSite=Lax';
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className={bodyClasses}>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <Outlet />
    </ThemeProvider>
  );
}

/**
 * Error boundary for the app
 *
 * @param {Object} error - The error object
 * @returns {React.ReactNode} The error boundary component
 */
export function ErrorBoundary({ error }) {
  let message = 'Oops!';
  let details = 'An unexpected error occurred.';
  let stack;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? '404' : 'Error';
    details =
      error.status === 404
        ? 'The requested page could not be found.'
        : error.statusText || details;
  } else if (
    process.env.NODE_ENV === 'development' &&
    error &&
    error instanceof Error
  ) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="container mx-auto p-4 pt-16">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full overflow-x-auto p-4">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
