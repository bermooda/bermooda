import { redirect } from 'react-router';

/**
 * /admin/login — redirects to /admin (canonical entry point).
 * Preserves the returnTo query param for post-login redirect.
 */
export function loader({ request }) {
  const url = new URL(request.url);
  const returnTo = url.searchParams.get('returnTo');
  const dest = returnTo
    ? `/admin?returnTo=${encodeURIComponent(returnTo)}`
    : '/admin';
  return redirect(dest, 302);
}

export default function AdminLoginRoute() {
  return null;
}
