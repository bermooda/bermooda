import { Form, Link } from 'react-router';

import FieldControl from '#/components/admin/create-page/control';
import Reveal from '#/components/admin/create-page/reveal';
import { allFields, fieldDomId } from '#/components/admin/create-page/spec';

/** @typedef {import('#/components/admin/create-page/spec').CreatePageSpec} CreatePageSpec */
/** @typedef {import('#/components/admin/create-page/spec').CreateFieldSpec} CreateFieldSpec */

/*
 * Blueprint — technical drafting.
 * Graphite paper ruled with a cyan 8/64px grid, corner registration brackets,
 * a spec-sheet stamp, and monospace throughout. Every control is a numbered
 * entry on a drawing, sharp-cornered and machined.
 *
 * ground #0A0D12 · plate #10151C · rule #1E2833 · text #D3E1EC
 * muted #6C8595 · cyan #5CC8FF
 */

const FONT_MONO =
  "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace";
const FONT_SANS = "'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif";

const CONTROL =
  'block w-full rounded-none border border-[#1E2833] bg-[#0A0D12] px-3 py-2.5 text-[13px] text-[#D3E1EC] outline-none transition placeholder:text-[#4C6272] hover:border-[#2C3D4C] focus:border-[#5CC8FF] focus:bg-[#0C1219] focus:shadow-[0_0_0_1px_#5CC8FF,0_0_18px_-4px_#5CC8FF]';

/**
 * Registration bracket drawn at one corner of the plate.
 *
 * @param {Object} props
 * @param {string} props.className Positioning + border-edge classes
 * @returns {React.ReactElement}
 */
function Bracket({ className }) {
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute h-4 w-4 border-[#5CC8FF]/60 ${className}`}
    />
  );
}

/**
 * @param {Object} props
 * @param {CreateFieldSpec} props.field
 * @param {string} props.sectionId
 * @param {number} props.index Global field index, printed as the entry number
 * @returns {React.ReactElement}
 */
function BlueprintField({ field, sectionId, index }) {
  const isSelect = field.type === 'select';

  return (
    <div className={field.full ? 'sm:col-span-2' : ''}>
      <label
        htmlFor={fieldDomId(sectionId, field.name)}
        className="flex items-baseline gap-2 text-[10px] tracking-[0.18em] uppercase"
        style={{ fontFamily: FONT_MONO }}
      >
        <span className="text-[#5CC8FF]">{String(index).padStart(2, '0')}</span>
        <span className="text-[#8FA7B6]">{field.label}</span>
        <span
          aria-hidden="true"
          className="mx-1 h-px min-w-3 flex-1 bg-[#1E2833]"
        />
        <span className={field.required ? 'text-[#5CC8FF]' : 'text-[#4C6272]'}>
          {field.required ? 'REQ' : 'OPT'}
        </span>
      </label>

      <div className="relative mt-2">
        <FieldControl
          field={field}
          sectionId={sectionId}
          className={isSelect ? `${CONTROL} appearance-none pr-9` : CONTROL}
        />
        {isSelect && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 flex w-8 items-center justify-center border-l border-[#1E2833] text-[10px] text-[#5CC8FF]"
            style={{ fontFamily: FONT_MONO }}
          >
            ▼
          </span>
        )}
      </div>

      {field.hint && (
        <p
          className="mt-2 text-[11px] text-[#6C8595]"
          style={{ fontFamily: FONT_MONO }}
        >
          {'// '}
          {field.hint}
        </p>
      )}
    </div>
  );
}

/**
 * Blueprint create-page design.
 *
 * @param {Object} props
 * @param {CreatePageSpec} props.spec
 * @param {boolean} props.isSaving
 * @returns {React.ReactElement}
 */
export default function BlueprintCreatePage({ spec, isSaving }) {
  const fields = allFields(spec);
  const requiredCount = fields.filter((field) => field.required).length;
  let fieldNumber = 0;

  return (
    <div
      className="cp-drafting-grid relative overflow-hidden rounded-md bg-[#0A0D12] px-5 py-10 text-[#D3E1EC] sm:px-10 sm:py-12"
      style={{ fontFamily: FONT_SANS }}
    >
      {/* Vignette so the grid fades toward the edges of the sheet. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,#0A0D12_95%)]"
      />

      <div className="relative mx-auto max-w-5xl">
        <Reveal as="header" delay={0}>
          <div className="flex flex-col gap-6 border-b border-[#1E2833] pb-7 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <nav aria-label="Breadcrumb">
                <ol
                  className="flex flex-wrap items-center gap-1.5 text-[11px] tracking-[0.14em] text-[#6C8595] uppercase"
                  style={{ fontFamily: FONT_MONO }}
                >
                  {spec.breadcrumbs.map((crumb, index) => (
                    <li key={crumb.label} className="flex items-center gap-1.5">
                      {index > 0 && (
                        <span aria-hidden="true" className="text-[#33454F]">
                          /
                        </span>
                      )}
                      {crumb.href ? (
                        <Link
                          to={crumb.href}
                          className="transition-colors hover:text-[#5CC8FF]"
                        >
                          {crumb.label}
                        </Link>
                      ) : (
                        <span className="text-[#D3E1EC]">{crumb.label}</span>
                      )}
                    </li>
                  ))}
                </ol>
              </nav>

              <h1 className="mt-4 text-[2rem] leading-none font-semibold tracking-[-0.03em] text-[#EEF6FC]">
                {spec.title}
              </h1>
              {spec.subtitle && (
                <p className="mt-3 max-w-lg text-[13.5px] leading-relaxed text-[#8FA7B6]">
                  {spec.subtitle}
                </p>
              )}
            </div>

            {/* Title-block stamp, as on a real drawing sheet. */}
            <dl
              className="grid shrink-0 grid-cols-3 border border-[#1E2833] bg-[#10151C] text-[10px] tracking-[0.14em] uppercase"
              style={{ fontFamily: FONT_MONO }}
            >
              {[
                ['Sheet', '01'],
                ['Fields', String(fields.length).padStart(2, '0')],
                ['Req', String(requiredCount).padStart(2, '0')],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="border-r border-[#1E2833] px-4 py-2.5 last:border-r-0"
                >
                  <dt className="text-[#4C6272]">{label}</dt>
                  <dd className="mt-1 text-[15px] text-[#5CC8FF]">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Reveal>

        {spec.error && (
          <div
            role="alert"
            className="mt-7 flex items-start gap-3 border border-[#F0674A]/50 bg-[#F0674A]/8 px-4 py-3"
            style={{ fontFamily: FONT_MONO }}
          >
            <span
              aria-hidden="true"
              className="mt-px shrink-0 bg-[#F0674A] px-1.5 py-0.5 text-[10px] font-bold tracking-[0.12em] text-[#0A0D12]"
            >
              ERR
            </span>
            <p className="text-[12.5px] text-[#F5A08C]">{spec.error}</p>
          </div>
        )}

        <Form method="post" className="mt-9 space-y-9">
          {spec.sections.map((section, index) => (
            <Reveal key={section.id} delay={110 + index * 90}>
              <fieldset className="relative border border-[#1E2833] bg-[#10151C]/85 p-6 backdrop-blur-[2px] sm:p-8">
                <Bracket className="-top-px -left-px border-t border-l" />
                <Bracket className="-top-px -right-px border-t border-r" />
                <Bracket className="-bottom-px -left-px border-b border-l" />
                <Bracket className="-right-px -bottom-px border-r border-b" />

                <legend className="sr-only">{section.title}</legend>

                <div className="mb-7 flex items-baseline gap-3">
                  <span
                    className="shrink-0 border border-[#5CC8FF]/40 px-2 py-0.5 text-[10px] tracking-[0.18em] text-[#5CC8FF]"
                    style={{ fontFamily: FONT_MONO }}
                  >
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <h2
                    className="text-[12px] font-medium tracking-[0.22em] text-[#D3E1EC] uppercase"
                    style={{ fontFamily: FONT_MONO }}
                  >
                    {section.title}
                  </h2>
                  <span
                    aria-hidden="true"
                    className="h-px flex-1 bg-[repeating-linear-gradient(90deg,#1E2833_0_5px,transparent_5px_10px)]"
                  />
                </div>

                {section.description && (
                  <p className="-mt-4 mb-7 max-w-xl text-[13px] leading-relaxed text-[#6C8595]">
                    {section.description}
                  </p>
                )}

                <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
                  {section.fields.map((field) => {
                    fieldNumber += 1;
                    return (
                      <BlueprintField
                        key={field.name}
                        field={field}
                        sectionId={section.id}
                        index={fieldNumber}
                      />
                    );
                  })}
                </div>
              </fieldset>
            </Reveal>
          ))}

          <Reveal
            delay={110 + spec.sections.length * 90}
            className="flex flex-wrap items-center justify-between gap-4 border border-[#1E2833] bg-[#10151C] px-5 py-4"
          >
            <p
              className="text-[11px] tracking-[0.14em] text-[#4C6272] uppercase"
              style={{ fontFamily: FONT_MONO }}
            >
              Status ·{' '}
              <span className="text-[#5CC8FF]">
                {isSaving ? 'Writing' : 'Ready'}
              </span>
            </p>

            <div className="flex items-center gap-3">
              <Link
                to={spec.cancelHref}
                className="border border-[#1E2833] px-4 py-2 text-[11px] tracking-[0.16em] text-[#8FA7B6] uppercase transition-colors hover:border-[#2C3D4C] hover:text-[#D3E1EC]"
                style={{ fontFamily: FONT_MONO }}
              >
                Discard
              </Link>
              <button
                type="submit"
                disabled={isSaving}
                className="border border-[#5CC8FF] bg-[#5CC8FF] px-6 py-2 text-[11px] font-semibold tracking-[0.16em] text-[#06222F] uppercase transition hover:bg-[#8ED9FF] hover:shadow-[0_0_22px_-6px_#5CC8FF] disabled:opacity-50"
                style={{ fontFamily: FONT_MONO }}
              >
                {isSaving
                  ? (spec.submittingLabel ?? 'Saving…')
                  : spec.submitLabel}
              </button>
            </div>
          </Reveal>
        </Form>
      </div>
    </div>
  );
}
