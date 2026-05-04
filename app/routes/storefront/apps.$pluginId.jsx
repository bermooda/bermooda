import { resolvePluginRoute } from '#/core/plugins/index.server';

export async function loader({ request, params }) {
  const descriptor = resolvePluginRoute(
    params.pluginId,
    new URL(request.url).pathname
  );
  if (!descriptor) {
    throw new Response('Plugin route not found', { status: 404 });
  }
  return { descriptor };
}

export default function PluginDispatcher() {
  // Phase 3 will render the resolved plugin component here
  return (
    <div>
      Plugin dispatcher — component resolved at runtime from plugin manifest
    </div>
  );
}
