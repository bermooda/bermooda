import { redirect } from 'react-router';

/**
 * /admin index — redirects immediately to /admin/dashboard
 */
export function loader() {
  return redirect('/admin/dashboard', 302);
}

export default function AdminIndexRoute() {
  return null;
}
