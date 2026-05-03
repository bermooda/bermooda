/**
 * @type {import('@react-router/dev/config').Config}
 */
export default {
  // Server-side render by default, to enable SPA mode set this to `false`
  ssr: true,

  future: {
    // Read more here: https://remix.run/blog/split-route-modules
    // unstable_splitRouteModules: true,
    v8_middleware: true,
  },
};
