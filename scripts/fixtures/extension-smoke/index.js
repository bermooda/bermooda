// CI fixture theme (see "Extension smoke build" in .github/workflows/ci.yml
// and scripts/check-extension-smoke-build.mjs).
// - `p-limit` is extension-only and itself imports `yocto-queue`; neither is a
//   shop-root dependency, so the build needs this folder's nested install.
// - `clsx@1` shadows the shop root's `clsx@2`; without `ssr.noExternal` the
//   SSR build would externalize it and resolve the root copy at runtime.
import clsx from 'clsx';
import pLimit from 'p-limit';

import { defineTheme } from '#/core/themes/define';

const limit = pLimit(1);

function SmokePage() {
  return clsx('extension-smoke', `concurrency-${limit.concurrency}`);
}

export default defineTheme({
  components: {
    Layout: SmokePage,
    HomePage: SmokePage,
    ProductPage: SmokePage,
    CategoryPage: SmokePage,
    CartPage: SmokePage,
    CheckoutLayout: SmokePage,
    NotFoundPage: SmokePage,
  },
});
