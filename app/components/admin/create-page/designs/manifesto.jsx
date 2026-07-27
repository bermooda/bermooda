import { Form, Link } from 'react-router';

import FieldControl from '#/components/admin/create-page/control';
import Reveal from '#/components/admin/create-page/reveal';
import { fieldDomId } from '#/components/admin/create-page/spec';

/** @typedef {import('#/components/admin/create-page/spec').CreatePageSpec} CreatePageSpec */
/** @typedef {import('#/components/admin/create-page/spec').CreateFieldSpec} CreateFieldSpec */

/*
 * Manifesto — neo-brutalist print shop.
 * Bone stock, 2px ink rules, hard offset shadows that snap on focus, and a
 * lime highlight used sparingly enough to stay a signal. Nothing is rounded
 * and nothing is subtle.
 *
 * bone #F1EDE3 · ink #121212 · lime #D6F32F · flag #FF5A1F
 */

const FONT_DISPLAY = "'Archivo Black', ui-sans-serif, system-ui, sans-serif";
const FONT_BODY = "'Archivo', ui-sans-serif, system-ui, sans-serif";

const CONTROL =
  'block w-full rounded-none border-2 border-[#121212] bg-white px-3.5 py-2.5 text-[15px] font-medium text-[#121212] shadow-[4px_4px_0_0_#121212] outline-none transition-[box-shadow,transform,background-color] duration-150 placeholder:font-normal placeholder:text-[#9A9488] hover:bg-[#FBFAF6] focus:translate-x-[3px] focus:translate-y-[3px] focus:bg-[#FCFFE8] focus:shadow-[1px_1px_0_0_#121212]';

/**
 * @param {Object} props
 * @param {CreateFieldSpec} props.field
 * @param {string} props.sectionId
 * @returns {React.ReactElement}
 */
function ManifestoField({ field, sectionId }) {
  const isSelect = field.type === 'select';

  return (
    <div className={field.full ? 'sm:col-span-2' : ''}>
      <div className="mb-2 flex items-center gap-2">
        <label
          htmlFor={fieldDomId(sectionId, field.name)}
          className="text-[11px] font-bold tracking-[0.14em] text-[#121212] uppercase"
        >
          {field.label}
        </label>
        <span
          className={`border-2 border-[#121212] px-1.5 text-[9px] font-bold tracking-[0.1em] uppercase ${
            field.required ? 'bg-[#D6F32F]' : 'bg-transparent text-[#5E594F]'
          }`}
        >
          {field.required ? 'Required' : 'Optional'}
        </span>
      </div>

      <div className="relative">
        <FieldControl
          field={field}
          sectionId={sectionId}
          className={isSelect ? `${CONTROL} appearance-none pr-12` : CONTROL}
        />
        {isSelect && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-0 right-0 flex h-full w-10 items-center justify-center border-l-2 border-[#121212] bg-[#D6F32F] text-[11px] font-bold"
          >
            ▼
          </span>
        )}
      </div>

      {field.hint && (
        <p className="mt-2.5 text-[12.5px] leading-snug font-medium text-[#5E594F]">
          {field.hint}
        </p>
      )}
    </div>
  );
}

/**
 * Manifesto create-page design.
 *
 * @param {Object} props
 * @param {CreatePageSpec} props.spec
 * @param {boolean} props.isSaving
 * @returns {React.ReactElement}
 */
export default function ManifestoCreatePage({ spec, isSaving }) {
  const tickerText = (spec.eyebrow ?? spec.title).toUpperCase();

  return (
    <div
      className="relative overflow-hidden border-2 border-[#121212] bg-[#F1EDE3] text-[#121212]"
      style={{ fontFamily: FONT_BODY }}
    >
      {/* Ticker rail: a printer's slug line running above the masthead. */}
      <div className="overflow-hidden border-b-2 border-[#121212] bg-[#121212] py-1.5">
        <div className="cp-ticker flex w-max whitespace-nowrap">
          {[0, 1].map((copy) => (
            <span key={copy} className="flex" aria-hidden={copy === 1}>
              {Array.from({ length: 8 }, (_, index) => (
                <span
                  key={index}
                  className="px-5 text-[10px] font-bold tracking-[0.3em] text-[#D6F32F] uppercase"
                >
                  {tickerText} ✦
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>

      <div className="px-5 py-9 sm:px-9 sm:py-12">
        <div className="mx-auto max-w-5xl">
          <Reveal as="header" delay={0}>
            <nav aria-label="Breadcrumb" className="mb-6">
              <ol className="flex flex-wrap items-center gap-2">
                {spec.breadcrumbs.map((crumb) => (
                  <li key={crumb.label}>
                    {crumb.href ? (
                      <Link
                        to={crumb.href}
                        className="inline-block border-2 border-[#121212] bg-white px-2.5 py-1 text-[10px] font-bold tracking-[0.12em] uppercase transition-colors hover:bg-[#D6F32F]"
                      >
                        {crumb.label}
                      </Link>
                    ) : (
                      <span className="inline-block border-2 border-[#121212] bg-[#121212] px-2.5 py-1 text-[10px] font-bold tracking-[0.12em] text-[#F1EDE3] uppercase">
                        {crumb.label}
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            </nav>

            <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0">
                <h1
                  className="text-[clamp(2.5rem,7vw,4.5rem)] leading-[0.86] tracking-[-0.04em] uppercase"
                  style={{ fontFamily: FONT_DISPLAY }}
                >
                  {spec.title}
                </h1>
                {spec.subtitle && (
                  <p className="mt-5 max-w-md border-l-4 border-[#FF5A1F] pl-4 text-[14.5px] leading-relaxed font-medium">
                    {spec.subtitle}
                  </p>
                )}
              </div>

              <span
                aria-hidden="true"
                className="cp-diagonal-hatch hidden h-24 w-24 shrink-0 border-2 border-[#121212] sm:block"
              />
            </div>
          </Reveal>

          {spec.error && (
            <div
              role="alert"
              className="mt-8 flex items-center gap-3 border-2 border-[#121212] bg-[#FF5A1F] px-4 py-3 shadow-[5px_5px_0_0_#121212]"
            >
              <span className="shrink-0 border-2 border-[#121212] bg-white px-2 py-0.5 text-[10px] font-bold tracking-[0.12em] uppercase">
                Stop
              </span>
              <p className="text-[14px] font-bold text-white">{spec.error}</p>
            </div>
          )}

          <Form method="post" className="mt-10 space-y-8">
            {spec.sections.map((section, index) => (
              <Reveal
                key={section.id}
                delay={110 + index * 90}
                className="border-2 border-[#121212] bg-white shadow-[7px_7px_0_0_#121212]"
              >
                <div className="flex items-center gap-3 border-b-2 border-[#121212] bg-[#121212] px-4 py-2.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center bg-[#D6F32F] text-[11px] font-bold text-[#121212]">
                    {index + 1}
                  </span>
                  <h2
                    className="truncate text-[13px] tracking-[0.16em] text-[#F1EDE3] uppercase"
                    style={{ fontFamily: FONT_DISPLAY }}
                  >
                    {section.title}
                  </h2>
                </div>

                <div className="p-5 sm:p-7">
                  {section.description && (
                    <p className="mb-7 max-w-xl text-[13.5px] leading-relaxed font-medium text-[#5E594F]">
                      {section.description}
                    </p>
                  )}
                  <div className="grid gap-x-7 gap-y-6 sm:grid-cols-2">
                    {section.fields.map((field) => (
                      <ManifestoField
                        key={field.name}
                        field={field}
                        sectionId={section.id}
                      />
                    ))}
                  </div>
                </div>
              </Reveal>
            ))}

            <Reveal
              delay={110 + spec.sections.length * 90}
              className="flex flex-wrap items-center justify-between gap-4 border-2 border-[#121212] bg-[#121212] px-5 py-4"
            >
              <p className="text-[11px] font-bold tracking-[0.16em] text-[#8A8578] uppercase">
                No drafts. No autosave.
              </p>

              <div className="flex items-center gap-4">
                <Link
                  to={spec.cancelHref}
                  className="text-[11px] font-bold tracking-[0.16em] text-[#F1EDE3] uppercase underline decoration-2 underline-offset-4 transition-colors hover:text-[#FF5A1F]"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="border-2 border-[#F1EDE3] bg-[#D6F32F] px-7 py-2.5 text-[12px] font-bold tracking-[0.14em] text-[#121212] uppercase shadow-[5px_5px_0_0_#F1EDE3] transition-[box-shadow,transform] duration-150 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[3px_3px_0_0_#F1EDE3] disabled:opacity-60"
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
    </div>
  );
}
