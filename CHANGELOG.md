# Changelog

## [0.9.3](https://github.com/bermooda/bermooda/compare/bermooda-v0.9.2...bermooda-v0.9.3) (2026-08-06)


### Bug Fixes

* **i18n:** bundle catalogs for production SSR admin translations ([#218](https://github.com/bermooda/bermooda/issues/218)) ([759d77e](https://github.com/bermooda/bermooda/commit/759d77e3383ecb67ed1655b2f7d8f5d5a6d76eec))

## [0.9.2](https://github.com/bermooda/bermooda/compare/bermooda-v0.9.1...bermooda-v0.9.2) (2026-08-06)


### Bug Fixes

* **ci:** ensure bermooda.config.js before build and test ([#217](https://github.com/bermooda/bermooda/issues/217)) ([58e6bb3](https://github.com/bermooda/bermooda/commit/58e6bb33b80bc4f51ed0be88f380f43c15adc82e))
* generate shop config on install and skip admin 2FA until email is ready ([#215](https://github.com/bermooda/bermooda/issues/215)) ([f18c6e9](https://github.com/bermooda/bermooda/commit/f18c6e98185e0ae0eb265711c736aae8fa2f1d47))

## [0.9.1](https://github.com/bermooda/bermooda/compare/bermooda-v0.9.0...bermooda-v0.9.1) (2026-08-06)


### Bug Fixes

* **slug-field:** adjust padding class from "pl-7" to "pl-4.5" for improved layout ([339916f](https://github.com/bermooda/bermooda/commit/339916fa566aa237a8c755ed742a3f7098379423))

## [0.9.0](https://github.com/bermooda/bermooda/compare/bermooda-v0.8.0...bermooda-v0.9.0) (2026-08-05)


### Features

* **admin:** migrate orders index to sticky design language ([#199](https://github.com/bermooda/bermooda/issues/199)) ([8d480a1](https://github.com/bermooda/bermooda/commit/8d480a175d71bd1335fd5a70e84e0daf8a0e42f1))
* **pricing:** enhance getPriceList to include translated product titles and update related tests ([fdc082a](https://github.com/bermooda/bermooda/commit/fdc082a5f98461d13194d24b5f3032c0b3732ed0))

## [0.8.0](https://github.com/bermooda/bermooda/compare/bermooda-v0.7.0...bermooda-v0.8.0) (2026-08-04)


### Features

* **themes:** storefront theme settings and Layout ownership ([#188](https://github.com/bermooda/bermooda/issues/188)) ([22a6bfa](https://github.com/bermooda/bermooda/commit/22a6bfa5aab56d585ed7d3e43f264f4f2d017ec0))

## [0.7.0](https://github.com/bermooda/bermooda/compare/bermooda-v0.6.1...bermooda-v0.7.0) (2026-08-04)


### Features

* **admin:** restyle product editor as two-column form layout ([#187](https://github.com/bermooda/bermooda/issues/187)) ([f7e42a3](https://github.com/bermooda/bermooda/commit/f7e42a3fcaba685c961359e8d8f071316ae1333a))
* **admin:** sticky-header products table layout ([#185](https://github.com/bermooda/bermooda/issues/185)) ([2d85561](https://github.com/bermooda/bermooda/commit/2d85561b5585821506a11c4813bb4cff35e48c20))

## [0.6.1](https://github.com/bermooda/bermooda/compare/bermooda-v0.6.0...bermooda-v0.6.1) (2026-08-03)


### Bug Fixes

* **themes:** restore Tailwind utilities for installed extensions ([#183](https://github.com/bermooda/bermooda/issues/183)) ([0b47a52](https://github.com/bermooda/bermooda/commit/0b47a52a4c6c402ab993db3cd3dc67b60b0ba708))

## [0.6.0](https://github.com/bermooda/bermooda/compare/bermooda-v0.5.0...bermooda-v0.6.0) (2026-08-03)


### Features

* **reporting:** enhance metrics functions to support locale parameter ([aafa115](https://github.com/bermooda/bermooda/commit/aafa115cd42f9f2f4634780ae68b63203b8c808b))


### Bug Fixes

* harden themes/plugins architecture and storefront contracts ([#178](https://github.com/bermooda/bermooda/issues/178)) ([e5009ad](https://github.com/bermooda/bermooda/commit/e5009ada8a81d16f995dd5266aecd892a35bf7ab))
* **plugins:** break defineProvider circular import during discovery ([f2acd62](https://github.com/bermooda/bermooda/commit/f2acd624903067155dc3cc3bb51029bb809a41c6))
* **plugins:** break defineProvider circular import during discovery ([ef036cd](https://github.com/bermooda/bermooda/commit/ef036cd1044bbbf9153854e7ca7f67e082877c85))
* **tests:** correct import order in reporting test file ([c0ec987](https://github.com/bermooda/bermooda/commit/c0ec9874787263a68ba0f52685e3b6f8626296d6))

## [0.5.0](https://github.com/bermooda/bermooda/compare/bermooda-v0.4.0...bermooda-v0.5.0) (2026-08-02)


### Features

* **admin:** complete translation phase 3 follow-ups ([#177](https://github.com/bermooda/bermooda/issues/177)) ([4a995fc](https://github.com/bermooda/bermooda/commit/4a995fc539bbd6f55b388b815e9168dbd40748ca))
* **admin:** translate shell via useT with message en-fallback ([#176](https://github.com/bermooda/bermooda/issues/176)) ([80231ab](https://github.com/bermooda/bermooda/commit/80231ab7e92cf47720bacdb9f8f57375af27dd27))
* **emails:** complete locale catalogs and migrate auth templates ([#174](https://github.com/bermooda/bermooda/issues/174)) ([c575cff](https://github.com/bermooda/bermooda/commit/c575cffac9c0a9d09a7f2066d379b57c0fa92e7a))

## [0.4.0](https://github.com/bermooda/bermooda/compare/bermooda-v0.3.0...bermooda-v0.4.0) (2026-08-01)


### Features

* **auth:** invite staff with set-password email link ([#161](https://github.com/bermooda/bermooda/issues/161)) ([d5f59cb](https://github.com/bermooda/bermooda/commit/d5f59cb85231e3bdcd2dc662fc59d6dc9c67e3e4))
* **events:** queue domain events via LiteQuu job ([#165](https://github.com/bermooda/bermooda/issues/165)) ([ed92df2](https://github.com/bermooda/bermooda/commit/ed92df2ff9c579daacea50570847dfe8c92bfbfd))
* **plugins:** dispatcher actions and param routes ([#168](https://github.com/bermooda/bermooda/issues/168)) ([f56876c](https://github.com/bermooda/bermooda/commit/f56876cfa7d7de7d58966ea2bceb2a90579a2bb6))


### Bug Fixes

* **channels:** thread salesChannelId through cart and checkout ([#166](https://github.com/bermooda/bermooda/issues/166)) ([15aee9b](https://github.com/bermooda/bermooda/commit/15aee9bf4796a8465078d43198735a4cd9493696))

## [0.3.0](https://github.com/bermooda/bermooda/compare/bermooda-v0.2.0...bermooda-v0.3.0) (2026-07-31)


### Features

* **extensions:** install and bundle theme/plugin npm dependencies ([#159](https://github.com/bermooda/bermooda/issues/159)) ([eb8af6e](https://github.com/bermooda/bermooda/commit/eb8af6eae2cfcc6d737f675b29442547b1f9ff87))

## [0.2.0](https://github.com/bermooda/bermooda/compare/bermooda-v0.1.0...bermooda-v0.2.0) (2026-07-30)


### Features

* add internal-core group to oxfmtrc and clean up imports ([8be2727](https://github.com/bermooda/bermooda/commit/8be2727879a51b19b18ceeedf65d88e88aef6bfc))
* add storefront plugin routes ([a3fbf6c](https://github.com/bermooda/bermooda/commit/a3fbf6c5dade98ec2f7332493baaeecdb8a85350))
* **admin-products:** enhance product row interaction with keyboard navigation ([8c4767a](https://github.com/bermooda/bermooda/commit/8c4767a7ce91342a2600d7c267e15ab1f46ea859))
* **admin:** add scroll functionality to command palette for selected items ([c36fd77](https://github.com/bermooda/bermooda/commit/c36fd77d2cc0e6202879092aa40e747279bd9208))
* **admin:** add semantic design tokens, UI primitives, and Button variants ([c9d7f3b](https://github.com/bermooda/bermooda/commit/c9d7f3bccdf3ddc17d83b15c423b25579386fe03))
* **admin:** enhance layout with scroll detection and dynamic app name ([0910ff1](https://github.com/bermooda/bermooda/commit/0910ff180b6e6f79f401594bc52525f7454c9772))
* **admin:** migrate dashboard to admin UI primitives and tokens ([411b3aa](https://github.com/bermooda/bermooda/commit/411b3aad5e575fd4060c84af491276efb1700dab))
* **admin:** migrate reports and list pages to admin primitives and tokens ([789362c](https://github.com/bermooda/bermooda/commit/789362c3bac7407807c5178bc2c96f42fda6538d))
* **admin:** migrate reports and list pages to admin primitives and tokens ([88b0719](https://github.com/bermooda/bermooda/commit/88b07196c5f4b78c800da365da924f82835d72c1))
* **admin:** move CRUD create/edit flows to dedicated pages ([#139](https://github.com/bermooda/bermooda/issues/139)) ([ff47ae9](https://github.com/bermooda/bermooda/commit/ff47ae98137d3e95ac45d2d56a2ba626a85d6271))
* **admin:** redesign shell chrome and auth pages with semantic tokens ([9e0675f](https://github.com/bermooda/bermooda/commit/9e0675fcac2a97a4d5e015ed10b55c3095a3e38b))
* **alerting:** enhance alerting system with message notifications ([3ecea96](https://github.com/bermooda/bermooda/commit/3ecea961cc89a41672b5061a39afbe7e629deb3f))
* **alerting:** implement error alerting system with configurable provider ([61eaeab](https://github.com/bermooda/bermooda/commit/61eaeab05d12d69b363b98caab0d2198a03b6b91))
* **api:** split admin report endpoints for analytics slices ([983adf1](https://github.com/bermooda/bermooda/commit/983adf1ea8a0878bc79e84b14b3bea80e5727035))
* auto-wire plugin manifest providers ([707087d](https://github.com/bermooda/bermooda/commit/707087dc7470a27533a11ea6eb974b4d0bb3f205))
* bermooda Phase 0 + Phase 1 — SaaS removal, ecommerce baseline, foundational proofs ([07844f3](https://github.com/bermooda/bermooda/commit/07844f3c3aef783ea16046653977934b73890362))
* bermooda.engine compatibility + 0.1.0 beta versions ([#146](https://github.com/bermooda/bermooda/issues/146)) ([f77c9cb](https://github.com/bermooda/bermooda/commit/f77c9cb0965f3a1828bcf690015250a6ad72aa78))
* enhance checkout and payment processing with promotions and address validation ([6d81906](https://github.com/bermooda/bermooda/commit/6d819062b977727695a873085376d4770d4764f2))
* enhance HomePage layout and product listing ([17304bf](https://github.com/bermooda/bermooda/commit/17304bf91ee4048d79f269da3dc46720c9e34e1e))
* enhance routing structure and add account management features ([08b6090](https://github.com/bermooda/bermooda/commit/08b6090c5037f0ee46ec55a4afb14f7da0f5913d))
* external themes and plugins (no bundled hardcoding) ([#149](https://github.com/bermooda/bermooda/issues/149)) ([c34249e](https://github.com/bermooda/bermooda/commit/c34249e959d5476409a4af0549c12878fdce241c))
* implement audit logging and reporting features ([362e50a](https://github.com/bermooda/bermooda/commit/362e50af69904d78cf6a0ec2450afb3033ec6ef1))
* implement before-hooks blocking filter pipeline ([833f74c](https://github.com/bermooda/bermooda/commit/833f74c7f70fef4cefab5b757ebb35db8553f060))
* implement product attributes for faceted filtering and enhance search functionality ([2384209](https://github.com/bermooda/bermooda/commit/2384209ba7b36d63e9002dd2b5c027ee0287b839))
* implement W2 public and admin REST APIs with webhook support ([1ecc7a9](https://github.com/bermooda/bermooda/commit/1ecc7a935e1b59c29375a04b7678a9440757b3ef))
* MCP analytics reports Phase 2 (customers, inventory, exports) ([#137](https://github.com/bermooda/bermooda/issues/137)) ([160b22f](https://github.com/bermooda/bermooda/commit/160b22fa697fd93b245a2092b1e4f0cd61d3e325))
* **p0-2:** drop SaaS/org routes and polar service ([0aedfc1](https://github.com/bermooda/bermooda/commit/0aedfc165482b55f11eac162d4f4337776c2eaf8))
* **p0-3:** drop Polar and organization from config, auth, and landing ([fba6149](https://github.com/bermooda/bermooda/commit/fba6149da6d9cdfbe9190305dc07f5428a02124b))
* **p0-5:** fresh Prisma baseline — drop SaaS models, add User.role ([a5f2042](https://github.com/bermooda/bermooda/commit/a5f2042044cc552dabe1a9ea4172b96db69494b6))
* **p2:** shop schema — 28 models, initial-shop migration, generated client ([63f31b2](https://github.com/bermooda/bermooda/commit/63f31b2249646c0d6934fd923b6520b5b415b78f))
* **p3-1:** scaffold app/core/* domain stubs ([733e282](https://github.com/bermooda/bermooda/commit/733e2827031a93516885d55137950602081b4f48))
* **p3-2:** add public barrel for app/core module ([75d358d](https://github.com/bermooda/bermooda/commit/75d358d56c987cbdd9c41625df8f667d0e859174))
* **p3-3:** implement in-process event bus with error isolation ([3597323](https://github.com/bermooda/bermooda/commit/3597323296c29165c120a843b270d6b6025a5a19))
* **p3-4:** implement plugin loader with manifest validation, ctx, enable/disable ([b2637e6](https://github.com/bermooda/bermooda/commit/b2637e65b448254c283533f6acf41c7c034cada7))
* **p3-5:** implement theme loader with defineTheme, registry, TTL-cached resolver, and slot API ([6cc8716](https://github.com/bermooda/bermooda/commit/6cc8716e68b359a894649ddec3ababde2eba7116))
* **p3-6:** implement settings service with read-through TTL cache and seed defaults ([a5ae165](https://github.com/bermooda/bermooda/commit/a5ae1658ede9eb061ced3a66da591148b36dfed0))
* **p3-7:** add cookie injection guard, resolveLocale helper, and wire real useT ([20c1455](https://github.com/bermooda/bermooda/commit/20c1455fe718c972c9c2c367a8f0b8be232fc13d))
* **p3-7:** implement i18n resolver with locale negotiation, catalog merging, and t() ([4d54684](https://github.com/bermooda/bermooda/commit/4d546841722ebfc17be320a6b84a4e40ab3d2d23))
* **p3-8:** implement currency service with cookie resolution, price lookup, format, and cookie setter ([62aabb5](https://github.com/bermooda/bermooda/commit/62aabb5a1d67d27a8d4108d24b6c97c1196ddeb7))
* **p3-9:** add storage index with uploadMedia and re-export client primitives ([158e527](https://github.com/bermooda/bermooda/commit/158e527ddff6d5488e3995870d70245c5b5508cc))
* **p4-a:** implement catalog service with CRUD, slug resolution, translations ([a1e8440](https://github.com/bermooda/bermooda/commit/a1e844000dfc8e05e264caba01b5da93237f2b61))
* **p4-b:** implement cart service with currency lock, price snapshots, and guest merge ([a6caddb](https://github.com/bermooda/bermooda/commit/a6caddb821b403f43ce938cc8dcae2c3804a920b))
* **p4-c:** implement checkout totals engine and 4-step pipeline ([35eebc9](https://github.com/bermooda/bermooda/commit/35eebc9c91d215280ece1a31493bc937b9e2834f))
* **p4-d:** implement order service with transactional placeOrder, fulfillment, and refunds ([a993662](https://github.com/bermooda/bermooda/commit/a993662ea02f975d3272d824ac3b436d8732edb8))
* **p4-e:** implement payment registry and Stripe adapter, replace service shim ([63b7b99](https://github.com/bermooda/bermooda/commit/63b7b996cda62a27641cb015ff2bce6b3264ab94))
* **p4-f:** implement shipping registry and flat-rate adapter ([c60f851](https://github.com/bermooda/bermooda/commit/c60f851f5b8d4899b5622e8d75e210d3d9da5a00))
* **p4-g:** implement tax registry and simple-percent adapter ([2d15d84](https://github.com/bermooda/bermooda/commit/2d15d84b5749e2cf8fe07876aee2b8d76c22d355))
* **p4-h:** implement inventory service with atomic decrement and availability check ([def84ec](https://github.com/bermooda/bermooda/commit/def84ec6907bd56d031b9b2e5491ebd5875ecf0d))
* **p4-i:** implement discount engine with validation and atomic usage counting ([8209387](https://github.com/bermooda/bermooda/commit/82093877da850989e38cb5ea8f17e581090e30d2))
* **p4-j:** implement customer service for profile, address book, and order history ([1f8ee73](https://github.com/bermooda/bermooda/commit/1f8ee73d0cad536c9bd3e77ba2163b29473c359d))
* **p4-k:** implement generic webhook dispatcher, replace stripe-specific route ([8ba43c1](https://github.com/bermooda/bermooda/commit/8ba43c17cc9cf10333a9e74de861125199e2a3d8))
* **p5-10:** implement settings admin with 7 sections ([4d92a3b](https://github.com/bermooda/bermooda/commit/4d92a3b1816459a827c98e782e0cca2acc1d4052))
* **p5-11:** implement plugin admin dispatcher route ([9768b8d](https://github.com/bermooda/bermooda/commit/9768b8d3b83539299bde86d8a5c369d0f885b52e))
* **p5-1:** admin shell — layout, auth pages, route stubs, and routes config ([267c80d](https://github.com/bermooda/bermooda/commit/267c80d1b2209b9ee3f67b4055b0ea90af1cd78b))
* **p5-2:** admin dashboard with KPI tiles, recent orders table, and slot ([57f11a3](https://github.com/bermooda/bermooda/commit/57f11a316bdc7e2a485eb0da5cd441be30cad121))
* **p5-2:** admin dashboard with KPI tiles, recent orders, and widgets slot ([8fbf4f6](https://github.com/bermooda/bermooda/commit/8fbf4f64b177585e7610b7c529646076b7269117))
* **p5-3:** products admin — list, new product form, and full product editor ([d442c7d](https://github.com/bermooda/bermooda/commit/d442c7d1241087cb552e828163b892cb353faf87))
* **p5-4:** categories admin with tree view, inline create/edit, reorder, and delete ([ecc89a0](https://github.com/bermooda/bermooda/commit/ecc89a06e32bf80322e20cacf59d410af88e8bd3))
* **p5-5:** implement orders admin list and detail ([cc198d7](https://github.com/bermooda/bermooda/commit/cc198d7a2473a67583bae9c91720056cc8687b0d))
* **p5-6:** implement customers admin list and detail ([5e4fc2c](https://github.com/bermooda/bermooda/commit/5e4fc2c68946183dd2b885d00df9185cf127df2c))
* **p5-7:** implement discounts admin CRUD ([ec36198](https://github.com/bermooda/bermooda/commit/ec36198aa07b0a44e1c4afcd8f63eb809b5a31d6))
* **p5-8:** implement themes admin with registry list, activate, and settings form ([201e50b](https://github.com/bermooda/bermooda/commit/201e50b9423554e97e2d20e658d0c47d25e90003))
* **p5-9:** implement plugins admin with enable/disable, reorder, and settings form ([da3d242](https://github.com/bermooda/bermooda/commit/da3d24233ebc8901884c403c0d3fcf837a398adb))
* **p5:** add server-side status transition validation guard to order detail action ([efd5754](https://github.com/bermooda/bermooda/commit/efd5754c7c78871d352d4fb554e9a53c6e194d7a))
* **p6:** implement storefront + default theme + customer auth UI ([c6c288b](https://github.com/bermooda/bermooda/commit/c6c288bbeb7eea5027e26f2700a715e1b90e9b4a))
* **p6:** storefront + default theme + customer auth UI ([d9cc2b7](https://github.com/bermooda/bermooda/commit/d9cc2b7984ad17d9ec844fec616f9a7a7ea0c487))
* **p7:** sample-analytics plugin, shop email templates, queue jobs, seed script ([29400b1](https://github.com/bermooda/bermooda/commit/29400b1c5a24bc9a64a30418454ae8cbbf6db9f3))
* **p7:** sample-analytics plugin, shop emails, queue jobs, seed script ([2271610](https://github.com/bermooda/bermooda/commit/2271610b3b9acf6366a4abda333690513d7df0d2))
* **p8:** Vitest coverage suite — 392 tests, app/core/** ≥ 80% ([20cbeec](https://github.com/bermooda/bermooda/commit/20cbeec6fb2f05a307db0feb4a052139014d44c5))
* **p8:** Vitest coverage suite — 392 tests, app/core/** ≥ 80% ([fb0f144](https://github.com/bermooda/bermooda/commit/fb0f1446b10f8dd56012a596459828dc158dea51))
* **p9:** docs + E2E verification ([44dbf55](https://github.com/bermooda/bermooda/commit/44dbf55977a2e2038e82c8e69f556579688b939c))
* **p9:** docs + E2E verification — themes.md, plugins.md, testing.md, finalize auth/storage docs, seed fix ([6bede1c](https://github.com/bermooda/bermooda/commit/6bede1c73bf3760a7ad3af3cb8149272fb335965))
* Phase 1 — five foundational proofs ([0422252](https://github.com/bermooda/bermooda/commit/0422252c7598a93f3546c279869b0c6758518078))
* Phase A agent API readiness (bootstrap, categories, themes/plugins) ([#131](https://github.com/bermooda/bermooda/issues/131)) ([573f4df](https://github.com/bermooda/bermooda/commit/573f4df2f71c34edf309e7b2184a64e0b37cb4ae))
* Phase C/D agent API harden (media, inventory, scopes, audit) ([3406ff7](https://github.com/bermooda/bermooda/commit/3406ff7fa9379b98a24350f542b1a51fc60f34da))
* Phase C/D agent API harden (media, inventory, scopes, audit) ([3ca3167](https://github.com/bermooda/bermooda/commit/3ca3167ca438948f0643953df8a1a3d31429d4ad))
* Phase C/D agent API harden (media, inventory, scopes, audit) ([#132](https://github.com/bermooda/bermooda/issues/132)) ([590da23](https://github.com/bermooda/bermooda/commit/590da2321bb25278718b0f7ec24db130effa8adc))
* **phase-0:** cleanup SaaS scaffolding, fresh Prisma baseline, rewrite agent rules ([6d43927](https://github.com/bermooda/bermooda/commit/6d43927dfbcfeb050852397e051b99ecb53436b3))
* **phase-4:** domain services — catalog, cart, payments, shipping, tax, inventory, discounts, customers, checkout, orders, webhooks ([aa4f27b](https://github.com/bermooda/bermooda/commit/aa4f27b209f264eff77235451082e7af37182931))
* **plugins:** add admin view slots for plugin blocks ([#59](https://github.com/bermooda/bermooda/issues/59)) ([4afb5ad](https://github.com/bermooda/bermooda/commit/4afb5add2810f4c7692f9e2d5de6436c502368c2))
* **plugins:** encrypt password settings for email provider API keys ([#144](https://github.com/bermooda/bermooda/issues/144)) ([2b62556](https://github.com/bermooda/bermooda/commit/2b625561c1d0af1ef3c8f028e4706b032b21fd12))
* replace plugin/theme manifest.js with package.json identity ([#127](https://github.com/bermooda/bermooda/issues/127)) ([4a50e1e](https://github.com/bermooda/bermooda/commit/4a50e1eb6e3e061e965ff157d1dfb1d1cbac7772))
* **reporting:** add getOpsMetrics for ranged ops KPIs ([8705d99](https://github.com/bermooda/bermooda/commit/8705d997d63607c2579b009f778c5fbe529a30f7))
* **reporting:** include ops section in dashboard report ([5046359](https://github.com/bermooda/bermooda/commit/504635916889f7e339b4e3a023fe916326004b61))
* **W4:** returns/RMA, partial fulfillment, PDFs, lifecycle emails ([b8fb63d](https://github.com/bermooda/bermooda/commit/b8fb63d94452d600037fb6078f682df22db29f7d))
* **w5:** CMS pages, menus, reviews, and richer SEO ([79630b9](https://github.com/bermooda/bermooda/commit/79630b91748c44ed792201440b6314ae5f446e47))
* **w7:** multi-location inventory, B2B pricing, gift cards, wishlists ([2799221](https://github.com/bermooda/bermooda/commit/279922168f68594120b14154ea54bb323696f381))
* **w8:** platform hardening — Postgres, RBAC, rate limits, plugins, caching ([3278b26](https://github.com/bermooda/bermooda/commit/3278b26f7adfaeb353a57d80124b56af19628355))
* **w9:** loyalty, marketing automation, and multi-store sales channels ([bf93a21](https://github.com/bermooda/bermooda/commit/bf93a212f5baa4a3ab5499374a4f2d95ef4d2953))
* wire storefront plugin slots ([c13d866](https://github.com/bermooda/bermooda/commit/c13d8664028ea57525bda05f2d68c8cde57c2d0f))


### Bug Fixes

* **admin:** move AddCategoryForm close/reset logic into useEffect ([30b1cd6](https://github.com/bermooda/bermooda/commit/30b1cd6fbe26fc6ade1e16e427a84d8a45922a8d))
* apply three code-review fixes to storefront loader, theme registry, and cache ([d13a63b](https://github.com/bermooda/bermooda/commit/d13a63bd9afad8cd50fc2a1880dde75d147e3f0e))
* **cache:** use cache.has() for falsy-value hits; fix TTLCache named import; add tests ([5c4286b](https://github.com/bermooda/bermooda/commit/5c4286b36dfcfa7977d7d424ecde63a645ceeb4d))
* **ci:** use --legacy-peer-deps to resolve npm 11 peer dep conflict ([d594b80](https://github.com/bermooda/bermooda/commit/d594b80dd5aed294eef6cdd31397d0b9ff70ed2d))
* format admin redesign plan for oxfmt ([8a297fc](https://github.com/bermooda/bermooda/commit/8a297fc3dc4f8d742ff3a1d804c4b67f0e9b8cb3))
* format external-themes docs for oxfmt ([#151](https://github.com/bermooda/bermooda/issues/151)) ([7359f36](https://github.com/bermooda/bermooda/commit/7359f3627f7a876a2016d9986d5265f4e50e5ef2))
* format W7 files and resolve lint warnings ([a82fa7e](https://github.com/bermooda/bermooda/commit/a82fa7e8c2bac41766a24ffb947b875523debe8c))
* **lint:** remove unused vars, add prettierignore for coverage/, fix useEffect dep ([67830d2](https://github.com/bermooda/bermooda/commit/67830d290eae9ec4fae8e688712aa60ffb26241e))
* live-wire admin plugin toggles ([9faca53](https://github.com/bermooda/bermooda/commit/9faca53297311f28b91f748b8baa909fb28eae5c))
* **p3-3:** add off(), strengthen logger assertion, document checkout.* contract ([93be5b9](https://github.com/bermooda/bermooda/commit/93be5b96d8e4b98928d3bffddbfbd175ddad80f9))
* **p3-6:** consistent DEFAULTS encoding and route enable/disable through settings service ([67e1bf1](https://github.com/bermooda/bermooda/commit/67e1bf1ffe7ee9d5bec416803eb412c5fc8aa494))
* **p3-8:** validate cookie in getRequestCurrency, short-circuit fallback, add Max-Age to cookies ([d933d4a](https://github.com/bermooda/bermooda/commit/d933d4a057ee3bf9b18475286e1f55652e1a5088))
* **p3-9:** assert putObject is re-exported in storage test ([729308e](https://github.com/bermooda/bermooda/commit/729308ec25917b54d1f96f2cbc99658876307868))
* **p3-9:** ensure proper re-export of putObject in storage tests ([1a19348](https://github.com/bermooda/bermooda/commit/1a19348223835bf0118666f5a5990b1636b6e293))
* **p4-a:** fix setSlug constraint, listCategories children translation, createProduct prices ([b656f1e](https://github.com/bermooda/bermooda/commit/b656f1e379c387ff661af58a7136b0e5dabb0d7f))
* **p4-b:** atomic quantity increment, merge currency check, expireCarts FK guard ([235da2a](https://github.com/bermooda/bermooda/commit/235da2a19a80a43cd134e8d14f7e5df312e7928b))
* **p4-k:** remove stale SaaS getCheckoutSession import from landing page ([97039be](https://github.com/bermooda/bermooda/commit/97039bef4a4535fb912aa823342c997e56cf259a))
* **p5-1:** address code quality issues in admin shell ([baa9112](https://github.com/bermooda/bermooda/commit/baa91125fd1b6285c9625d1749a336c874c815af))
* **p5-1:** correct redirect targets and add locale switcher stub ([21ed5ba](https://github.com/bermooda/bermooda/commit/21ed5ba4c4a2998f441757bdbecbd70f80ddad99))
* **p5-3:** remove dead code and fix media upload data loss in products admin ([6f8ff10](https://github.com/bermooda/bermooda/commit/6f8ff10fd789661cbf95dfc5de7a71180197c977))
* **p5-6:** harden customers admin — cross-customer address guards and search fixes ([4a79dc7](https://github.com/bermooda/bermooda/commit/4a79dc7e536c2a3ff8aa80ef88b79c4cbbf9a224))
* **plugins:** idempotency guard, active-hook aggregation, JSON serialisation ([b66b8f6](https://github.com/bermooda/bermooda/commit/b66b8f63ae29d8a60bc5541f4e70e9797eca79e5))
* restore admin login by guarding process.env in browser ([#140](https://github.com/bermooda/bermooda/issues/140)) ([548a9d2](https://github.com/bermooda/bermooda/commit/548a9d2e22dbb29ed63a4ee2d758302b0723aae1))
* restore ChevronLeftIcon import and format W4 files ([16cec0a](https://github.com/bermooda/bermooda/commit/16cec0accd42c22d537ae8010af0c6526d254df5))
* satisfy oxfmt and update Admin API middleware tests ([18fe608](https://github.com/bermooda/bermooda/commit/18fe608a05a19485e55e99c55a8c80f0b81bd453))
