import { Outlet } from 'react-router';

/**
 * Public admin layout — pathless layout route wrapping auth pages
 * (login, forgot-password, reset-password, verify-2fa, logout).
 * No authentication required.
 *
 * @returns {React.ReactElement}
 */
export default function AdminPublicLayout() {
  return <Outlet />;
}
