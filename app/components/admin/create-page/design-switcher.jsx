import { useEffect, useState } from 'react';

/** @typedef {import('#/components/admin/create-page/designs').CreatePageDesign} CreatePageDesign */

const FONT_MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';

/**
 * Swatch tile summarising a design's background, ink, and accent.
 *
 * @param {Object} props
 * @param {[string, string, string]} props.swatch
 * @returns {React.ReactElement}
 */
function Swatch({ swatch }) {
  const [background, ink, accent] = swatch;

  return (
    <span
      aria-hidden="true"
      className="relative block h-7 w-7 overflow-hidden rounded-lg ring-1 ring-white/15"
      style={{
        background: `linear-gradient(135deg, ${background} 0 52%, ${ink} 52% 100%)`,
      }}
    >
      <span
        className="absolute right-1 bottom-1 block h-2 w-2 rounded-full"
        style={{ background: accent }}
      />
    </span>
  );
}

/**
 * DesignSwitcher
 * Review-only control for flipping between admin create-page design
 * candidates. Intentionally neutral so it never reads as part of the design
 * being evaluated. Remove once a candidate is adopted.
 *
 * @param {Object} props
 * @param {CreatePageDesign[]} props.designs
 * @param {string} props.designId
 * @param {(id: string) => void} props.onSelect
 * @param {(step: number) => void} props.onStep
 * @returns {React.ReactElement}
 */
export default function DesignSwitcher({
  designs,
  designId,
  onSelect,
  onStep,
}) {
  const [collapsed, setCollapsed] = useState(false);
  const active = designs.find((design) => design.id === designId);

  useEffect(() => {
    /** @param {KeyboardEvent} event */
    function handleKeyDown(event) {
      if (!event.altKey || event.metaKey || event.ctrlKey) return;

      if (event.code === 'BracketRight' || event.key === 'ArrowRight') {
        event.preventDefault();
        onStep(1);
        return;
      }
      if (event.code === 'BracketLeft' || event.key === 'ArrowLeft') {
        event.preventDefault();
        onStep(-1);
        return;
      }

      const position = Number(event.code.replace('Digit', ''));
      if (position >= 1 && position <= designs.length) {
        event.preventDefault();
        onSelect(designs[position - 1].id);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [designs, onSelect, onStep]);

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className="fixed right-4 bottom-4 z-40 flex items-center gap-2 rounded-full border border-white/12 bg-[#0C0D10]/92 px-3.5 py-2.5 text-[11px] font-medium text-white/70 shadow-[0_18px_40px_-16px_rgba(0,0,0,0.85)] backdrop-blur-xl transition hover:text-white"
      >
        {active && <Swatch swatch={active.swatch} />}
        <span style={{ fontFamily: FONT_MONO }}>Designs</span>
      </button>
    );
  }

  return (
    <div className="fixed right-4 bottom-4 z-40 w-[min(21rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-white/12 bg-[#0C0D10]/92 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-white/8 px-4 py-2.5">
        <span
          className="text-[10px] tracking-[0.22em] text-white/45 uppercase"
          style={{ fontFamily: FONT_MONO }}
        >
          Design review
        </span>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="-mr-1.5 rounded-md px-2 py-1 text-[11px] text-white/45 transition hover:bg-white/8 hover:text-white/85"
        >
          Hide
        </button>
      </div>

      <div className="flex items-center gap-2 px-4 pt-3.5">
        {designs.map((design, index) => {
          const isActive = design.id === designId;

          return (
            <button
              key={design.id}
              type="button"
              onClick={() => onSelect(design.id)}
              aria-pressed={isActive}
              title={`${design.name} — ${design.tagline}`}
              className={`relative rounded-xl p-1 transition ${
                isActive
                  ? 'bg-white/12 ring-1 ring-white/35'
                  : 'opacity-65 hover:opacity-100'
              }`}
            >
              <Swatch swatch={design.swatch} />
              <span
                className="mt-1 block text-center text-[9px] text-white/45"
                style={{ fontFamily: FONT_MONO }}
              >
                {index + 1}
              </span>
              <span className="sr-only">{design.name}</span>
            </button>
          );
        })}
      </div>

      {active && (
        <div className="px-4 pt-2.5 pb-3.5">
          <p className="flex items-center gap-2 text-[13px] font-semibold text-white">
            {active.name}
            <span
              className="rounded border border-white/15 px-1.5 py-px text-[9px] tracking-[0.1em] text-white/50 uppercase"
              style={{ fontFamily: FONT_MONO }}
            >
              {active.scheme}
            </span>
          </p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-white/50">
            {active.tagline}
          </p>
        </div>
      )}

      <p
        className="border-t border-white/8 px-4 py-2 text-[10px] tracking-[0.08em] text-white/35"
        style={{ fontFamily: FONT_MONO }}
      >
        ⌥1–{designs.length} select · ⌥← ⌥→ cycle
      </p>
    </div>
  );
}
