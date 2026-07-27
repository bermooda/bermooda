import AtelierCreatePage from '#/components/admin/create-page/designs/atelier';
import BlueprintCreatePage from '#/components/admin/create-page/designs/blueprint';
import ManifestoCreatePage from '#/components/admin/create-page/designs/manifesto';
import NocturneCreatePage from '#/components/admin/create-page/designs/nocturne';
import PrecisionCreatePage from '#/components/admin/create-page/designs/precision';

/**
 * @typedef {Object} CreatePageDesign
 * @property {string} id Stable id persisted in local storage
 * @property {string} name
 * @property {string} tagline One-line description of the aesthetic
 * @property {'light'|'dark'} scheme
 * @property {[string, string, string]} swatch Background, ink, and accent hex
 * @property {(props: { spec: import('#/components/admin/create-page/spec').CreatePageSpec, isSaving: boolean }) => React.ReactElement} Component
 */

/**
 * Candidate designs for admin create pages, in review order.
 *
 * @type {CreatePageDesign[]}
 */
export const CREATE_PAGE_DESIGNS = [
  {
    id: 'precision',
    name: 'Precision',
    tagline: 'Product craft with a live preview rail',
    scheme: 'light',
    swatch: ['#FAFAFB', '#0B0C0E', '#2B6CF6'],
    Component: PrecisionCreatePage,
  },
  {
    id: 'atelier',
    name: 'Atelier',
    tagline: 'Editorial letterpress on warm paper',
    scheme: 'light',
    swatch: ['#F6F1E7', '#1F1A15', '#8C2F27'],
    Component: AtelierCreatePage,
  },
  {
    id: 'nocturne',
    name: 'Nocturne',
    tagline: 'Frosted glass, aurora, champagne accent',
    scheme: 'dark',
    swatch: ['#08080B', '#F3F0EA', '#D9B676'],
    Component: NocturneCreatePage,
  },
  {
    id: 'blueprint',
    name: 'Blueprint',
    tagline: 'Drafting sheet, monospace, cyan grid',
    scheme: 'dark',
    swatch: ['#0A0D12', '#D3E1EC', '#5CC8FF'],
    Component: BlueprintCreatePage,
  },
  {
    id: 'manifesto',
    name: 'Manifesto',
    tagline: 'Neo-brutalist print shop, hard shadows',
    scheme: 'light',
    swatch: ['#F1EDE3', '#121212', '#D6F32F'],
    Component: ManifestoCreatePage,
  },
];

/**
 * Design rendered when nothing is stored yet. Once a candidate wins the
 * review, point this at the winner and drop the switcher.
 */
export const DEFAULT_CREATE_PAGE_DESIGN_ID = 'precision';

/**
 * Resolve a design by id, falling back to the default.
 *
 * @param {string | null | undefined} id
 * @returns {CreatePageDesign}
 */
export function getCreatePageDesign(id) {
  return (
    CREATE_PAGE_DESIGNS.find((design) => design.id === id) ??
    CREATE_PAGE_DESIGNS.find(
      (design) => design.id === DEFAULT_CREATE_PAGE_DESIGN_ID
    ) ??
    CREATE_PAGE_DESIGNS[0]
  );
}
