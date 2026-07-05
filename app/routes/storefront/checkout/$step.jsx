import { redirect } from 'react-router';

/** Legacy multi-step checkout URLs → single-page checkout. */
export async function loader() {
  return redirect('/checkout');
}

export default function LegacyCheckoutRedirect() {
  return null;
}
