import { resolveActiveTheme } from '#/core/themes/index.server';

export async function loader({ request: _request }) {
  const theme = resolveActiveTheme();
  return { themeName: theme.name };
}

export default function StorefrontIndex() {
  // Theme component resolution happens in the loader; the real
  // implementation in Phase 6 will render the theme's HomePage component.
  return (
    <div>
      <h1>bermooda storefront</h1>
      <p>
        Default theme active — Phase 6 will render the full themed storefront.
      </p>
    </div>
  );
}
