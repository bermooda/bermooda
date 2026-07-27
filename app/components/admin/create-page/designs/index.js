import CanvasCreatePage from '#/components/admin/create-page/designs/canvas';
import ConsoleCreatePage from '#/components/admin/create-page/designs/console';
import GuidedCreatePage from '#/components/admin/create-page/designs/guided';
import LedgerCreatePage from '#/components/admin/create-page/designs/ledger';
import StudioCreatePage from '#/components/admin/create-page/designs/studio';

// @ts-ignore -- side-effect stylesheet holding each design's colour tokens
import '#/styles/admin-create-page.css';

/**
 * @typedef {Object} CreatePageDesign
 * @property {string} id Stable id persisted in local storage
 * @property {string} name
 * @property {string} structure What is structurally different about it
 * @property {string} actions Where the primary action lives
 * @property {'single'|'stepped'} flow `stepped` designs reveal one field at a time
 * @property {[string, string, string]} swatchLight Background, ink, accent
 * @property {[string, string, string]} swatchDark Same, under the dark theme
 * @property {(props: { spec: import('#/components/admin/create-page/spec').CreatePageSpec, isSaving: boolean }) => React.ReactElement} Component
 */

/**
 * Candidate designs for admin create pages, in review order. Each one is a
 * different structural answer to "how should a create form be laid out" —
 * they deliberately disagree about where labels, fields, and actions belong.
 *
 * @type {CreatePageDesign[]}
 */
export const CREATE_PAGE_DESIGNS = [
  {
    id: 'studio',
    name: 'Studio',
    structure: 'Split canvas · dark context rail, label-beside-input rows',
    actions: 'Left rail',
    flow: 'single',
    swatchLight: ['#ffffff', '#17191e', '#dc4634'],
    swatchDark: ['#16181d', '#0a0b0e', '#ff6a55'],
    Component: StudioCreatePage,
  },
  {
    id: 'ledger',
    name: 'Ledger',
    structure: 'Dense record sheet · right-aligned label gutter, table rows',
    actions: 'Top-right toolbar',
    flow: 'single',
    swatchLight: ['#ffffff', '#0f1115', '#0f62fe'],
    swatchDark: ['#0e1013', '#e7eaee', '#4589ff'],
    Component: LedgerCreatePage,
  },
  {
    id: 'console',
    name: 'Console',
    structure: 'Command sheet · numbered gutter, one key=value line per field',
    actions: 'Bottom command bar',
    flow: 'single',
    swatchLight: ['#fbfbf9', '#1a1b18', '#1c7a4b'],
    swatchDark: ['#0c0e0d', '#dbe4de', '#4ade80'],
    Component: ConsoleCreatePage,
  },
  {
    id: 'guided',
    name: 'Guided',
    structure: 'One question per step · centred flow with a review gate',
    actions: 'Bottom-right, review step only',
    flow: 'stepped',
    swatchLight: ['#faf7f2', '#221f1a', '#1f6f63'],
    swatchDark: ['#14120f', '#f0eae0', '#55c3ac'],
    Component: GuidedCreatePage,
  },
  {
    id: 'canvas',
    name: 'Canvas',
    structure: 'Editorial · vertical section titles, ragged inline field flow',
    actions: 'Vertical bar on the right edge',
    flow: 'single',
    swatchLight: ['#efece6', '#12100e', '#c6362a'],
    swatchDark: ['#100f0d', '#f2efe9', '#ea7a6a'],
    Component: CanvasCreatePage,
  },
];

/**
 * Design rendered when nothing is stored yet. Once a candidate wins the
 * review, point this at the winner and drop the switcher.
 */
export const DEFAULT_CREATE_PAGE_DESIGN_ID = 'studio';

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
