import useAdminCreateDesign from '#/hooks/use-admin-create-design';
import DesignSwitcher from '#/components/admin/create-page/design-switcher';

// @ts-ignore -- side-effect stylesheet for the design candidates
import '#/styles/admin-create-page.css';

/** @typedef {import('#/components/admin/create-page/spec').CreatePageSpec} CreatePageSpec */

/**
 * CreatePage
 * Renders a `CreatePageSpec` with whichever design candidate is selected.
 * Routes describe their form as data and stay independent of the visual
 * decision, so adopting a winner is a change here rather than in 20 routes.
 *
 * @param {Object} props
 * @param {CreatePageSpec} props.spec
 * @param {boolean} props.isSaving
 * @param {boolean} [props.reviewMode=true] Show the design switcher
 * @returns {React.ReactElement}
 */
export default function CreatePage({ spec, isSaving, reviewMode = true }) {
  const { designId, design, designs, selectDesign, stepDesign } =
    useAdminCreateDesign();
  const Design = design.Component;

  return (
    <>
      {/* Keyed so switching designs starts each candidate from a clean slate. */}
      <Design key={designId} spec={spec} isSaving={isSaving} />
      {reviewMode && (
        <>
          {/* Scroll room so the floating switcher never traps a submit button. */}
          <div aria-hidden="true" className="h-32" />
          <DesignSwitcher
            designs={designs}
            designId={designId}
            onSelect={selectDesign}
            onStep={stepDesign}
          />
        </>
      )}
    </>
  );
}
