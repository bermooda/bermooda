import { Form, Link } from 'react-router';

import FieldControl from '#/components/admin/create-page/control';
import Reveal from '#/components/admin/create-page/reveal';
import { fieldDomId } from '#/components/admin/create-page/spec';

/** @typedef {import('#/components/admin/create-page/spec').CreatePageSpec} CreatePageSpec */
/** @typedef {import('#/components/admin/create-page/spec').CreateFieldSpec} CreateFieldSpec */

/*
 * Atelier — editorial letterpress.
 * Warm laid paper, an oxblood accent, hairline rules instead of boxes, and a
 * left rail of oldstyle numerals. Inputs are ruled lines, not containers, so
 * the page reads as a printed form rather than a dialog.
 *
 * paper #F6F1E7 · ink #1F1A15 · muted #6E6558 · rule #DDD3C0 · accent #8C2F27
 */

const FONT_DISPLAY = "'Instrument Serif', 'Iowan Old Style', Georgia, serif";
const FONT_BODY = "'Karla', ui-sans-serif, system-ui, sans-serif";

const CONTROL =
  'block w-full rounded-none border-0 border-b border-[#DDD3C0] bg-transparent px-0 pt-1 pb-2.5 text-[17px] text-[#1F1A15] outline-none transition-colors duration-200 placeholder:text-[#B7AC97] hover:border-[#BFB39B] focus:border-[#8C2F27]';

/**
 * Split a title so the closing word can be set in accented italic.
 *
 * @param {string} title
 * @returns {[string, string]}
 */
function splitTitle(title) {
  const index = title.lastIndexOf(' ');
  if (index === -1) return ['', title];
  return [title.slice(0, index), title.slice(index + 1)];
}

/**
 * @param {Object} props
 * @param {CreateFieldSpec} props.field
 * @param {string} props.sectionId
 * @returns {React.ReactElement}
 */
function AtelierField({ field, sectionId }) {
  const isSelect = field.type === 'select';

  return (
    <div className={field.full ? 'sm:col-span-2' : ''}>
      <label
        htmlFor={fieldDomId(sectionId, field.name)}
        className="block text-[10px] font-semibold tracking-[0.24em] text-[#6E6558] uppercase"
      >
        {field.label}
        {field.required && <span className="ml-1 text-[#8C2F27]">*</span>}
      </label>

      <div className="relative">
        <FieldControl
          field={field}
          sectionId={sectionId}
          className={
            isSelect ? `${CONTROL} appearance-none pr-7` : `${CONTROL}`
          }
        />
        {isSelect && (
          <svg
            aria-hidden="true"
            viewBox="0 0 12 8"
            className="pointer-events-none absolute right-0 bottom-4 h-2 w-3 text-[#8C2F27]"
          >
            <path
              d="M1 1l5 5 5-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            />
          </svg>
        )}
      </div>

      {field.hint && (
        <p
          className="mt-2 text-[13px] text-[#6E6558] italic"
          style={{ fontFamily: FONT_DISPLAY }}
        >
          {field.hint}
        </p>
      )}
    </div>
  );
}

/**
 * Atelier create-page design.
 *
 * @param {Object} props
 * @param {CreatePageSpec} props.spec
 * @param {boolean} props.isSaving
 * @returns {React.ReactElement}
 */
export default function AtelierCreatePage({ spec, isSaving }) {
  const [titleHead, titleTail] = splitTitle(spec.title);

  return (
    <div
      className="cp-paper-grain relative overflow-hidden rounded-sm bg-[#F6F1E7] px-6 py-14 text-[#1F1A15] shadow-[0_1px_0_rgba(31,26,21,0.08)] sm:px-12 lg:px-20"
      style={{ fontFamily: FONT_BODY }}
    >
      {/* Printed edge: a heavy rule doubled by a hairline, top and bottom. */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-[3px] bg-[#1F1A15]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-[6px] h-px bg-[#DDD3C0]"
      />

      <div className="relative mx-auto max-w-4xl">
        <Reveal as="header" delay={0}>
          <nav aria-label="Breadcrumb" className="mb-9">
            <ol className="flex flex-wrap items-center gap-2 text-[13px] text-[#6E6558]">
              {spec.breadcrumbs.map((crumb, index) => (
                <li key={crumb.label} className="flex items-center gap-2">
                  {index > 0 && (
                    <span aria-hidden="true" className="text-[#C4B79E]">
                      /
                    </span>
                  )}
                  {crumb.href ? (
                    <Link
                      to={crumb.href}
                      className="underline decoration-[#C4B79E] underline-offset-4 transition-colors hover:text-[#8C2F27] hover:decoration-[#8C2F27]"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="text-[#1F1A15]">{crumb.label}</span>
                  )}
                </li>
              ))}
            </ol>
          </nav>

          {spec.eyebrow && (
            <div className="mb-5 flex items-center gap-3">
              <span aria-hidden="true" className="h-px w-10 bg-[#8C2F27]" />
              <span className="text-[10px] font-semibold tracking-[0.42em] text-[#8C2F27] uppercase">
                {spec.eyebrow}
              </span>
            </div>
          )}

          <h1
            className="text-[clamp(2.75rem,7vw,4.25rem)] leading-[0.92] tracking-[-0.02em]"
            style={{ fontFamily: FONT_DISPLAY }}
          >
            {titleHead && <span>{titleHead} </span>}
            <em className="text-[#8C2F27] italic">{titleTail}</em>
          </h1>

          {spec.subtitle && (
            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-[#544B3F]">
              {spec.subtitle}
            </p>
          )}
        </Reveal>

        {spec.error && (
          <div
            role="alert"
            className="mt-10 border-l-2 border-[#8C2F27] bg-[#8C2F27]/8 py-3 pl-5"
          >
            <p
              className="text-[15px] text-[#8C2F27] italic"
              style={{ fontFamily: FONT_DISPLAY }}
            >
              {spec.error}
            </p>
          </div>
        )}

        <Form method="post" className="mt-14">
          {spec.sections.map((section, index) => (
            <Reveal
              key={section.id}
              as="section"
              delay={120 + index * 90}
              className="grid gap-x-14 gap-y-9 border-t border-[#DDD3C0] pt-10 pb-14 md:grid-cols-12"
            >
              <div className="md:col-span-4">
                <div
                  aria-hidden="true"
                  className="text-[2.75rem] leading-none text-[#8C2F27]/25"
                  style={{ fontFamily: FONT_DISPLAY }}
                >
                  {String(index + 1).padStart(2, '0')}
                </div>
                <h2
                  className="mt-3 text-[1.6rem] leading-tight"
                  style={{ fontFamily: FONT_DISPLAY }}
                >
                  {section.title}
                </h2>
                {section.description && (
                  <p className="mt-2.5 text-[14px] leading-relaxed text-[#6E6558]">
                    {section.description}
                  </p>
                )}
              </div>

              <div className="grid gap-x-10 gap-y-9 sm:grid-cols-2 md:col-span-8">
                {section.fields.map((field) => (
                  <AtelierField
                    key={field.name}
                    field={field}
                    sectionId={section.id}
                  />
                ))}
              </div>
            </Reveal>
          ))}

          <Reveal
            delay={120 + spec.sections.length * 90}
            className="flex flex-col gap-6 border-t-2 border-[#1F1A15] pt-7 sm:flex-row sm:items-center sm:justify-between"
          >
            <p
              className="max-w-xs text-[14px] text-[#6E6558] italic"
              style={{ fontFamily: FONT_DISPLAY }}
            >
              Fields marked with an asterisk are required.
            </p>

            <div className="flex items-center gap-7">
              <Link
                to={spec.cancelHref}
                className="text-[13px] tracking-[0.12em] text-[#6E6558] uppercase underline decoration-[#C4B79E] underline-offset-[6px] transition-colors hover:text-[#1F1A15]"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={isSaving}
                className="group inline-flex items-center gap-3 rounded-none bg-[#1F1A15] px-9 py-3.5 text-[12px] font-semibold tracking-[0.2em] text-[#F6F1E7] uppercase transition-colors hover:bg-[#8C2F27] disabled:opacity-55"
              >
                {isSaving
                  ? (spec.submittingLabel ?? 'Saving…')
                  : spec.submitLabel}
                <span
                  aria-hidden="true"
                  className="transition-transform duration-300 group-hover:translate-x-1"
                >
                  →
                </span>
              </button>
            </div>
          </Reveal>
        </Form>
      </div>
    </div>
  );
}
