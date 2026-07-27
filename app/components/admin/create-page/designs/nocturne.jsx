import { Form, Link } from 'react-router';

import FieldControl from '#/components/admin/create-page/control';
import Reveal from '#/components/admin/create-page/reveal';
import { fieldDomId } from '#/components/admin/create-page/spec';

/** @typedef {import('#/components/admin/create-page/spec').CreatePageSpec} CreatePageSpec */
/** @typedef {import('#/components/admin/create-page/spec').CreateFieldSpec} CreateFieldSpec */

/*
 * Nocturne — luxe dark glass.
 * A drifting aurora behind a single frosted panel, champagne as the only
 * chromatic accent, and a gold spine that threads the sections together.
 * Weight comes from light and depth rather than borders.
 *
 * ground #08080B · glass rgba(255,255,255,.045) · text #F3F0EA
 * muted #98938A · champagne #D9B676
 */

const FONT_DISPLAY = "'Syne', ui-sans-serif, system-ui, sans-serif";
const FONT_BODY = "'Manrope', ui-sans-serif, system-ui, sans-serif";

const CONTROL =
  'block w-full rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 text-[14.5px] text-[#F3F0EA] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] outline-none transition duration-200 placeholder:text-white/25 hover:border-white/18 hover:bg-white/[0.055] focus:border-[#D9B676]/70 focus:bg-white/[0.07] focus:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_0_3px_rgba(217,182,118,0.16)]';

/**
 * @param {Object} props
 * @param {CreateFieldSpec} props.field
 * @param {string} props.sectionId
 * @returns {React.ReactElement}
 */
function NocturneField({ field, sectionId }) {
  const isSelect = field.type === 'select';

  return (
    <div className={field.full ? 'sm:col-span-2' : ''}>
      <label
        htmlFor={fieldDomId(sectionId, field.name)}
        className="mb-2.5 flex items-center gap-2 text-[10.5px] font-semibold tracking-[0.2em] text-[#98938A] uppercase"
      >
        {field.label}
        {field.required && (
          <span
            aria-hidden="true"
            className="h-1 w-1 rounded-full bg-[#D9B676]"
          />
        )}
      </label>

      <div className="relative">
        <FieldControl
          field={field}
          sectionId={sectionId}
          className={isSelect ? `${CONTROL} appearance-none pr-11` : CONTROL}
        />
        {isSelect && (
          <svg
            aria-hidden="true"
            viewBox="0 0 12 8"
            className="pointer-events-none absolute top-1/2 right-4 h-2 w-3 -translate-y-1/2 text-[#D9B676]"
          >
            <path
              d="M1 1l5 5 5-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        )}
      </div>

      {field.hint && (
        <p className="mt-2 text-[12.5px] leading-relaxed text-[#7E7A73]">
          {field.hint}
        </p>
      )}
    </div>
  );
}

/**
 * Nocturne create-page design.
 *
 * @param {Object} props
 * @param {CreatePageSpec} props.spec
 * @param {boolean} props.isSaving
 * @returns {React.ReactElement}
 */
export default function NocturneCreatePage({ spec, isSaving }) {
  return (
    <div
      className="relative overflow-hidden rounded-3xl bg-[#08080B] px-5 py-14 text-[#F3F0EA] sm:px-10 sm:py-16"
      style={{ fontFamily: FONT_BODY }}
    >
      {/* Aurora: two slow-drifting radial washes, champagne over deep teal. */}
      <div
        aria-hidden="true"
        className="cp-aurora pointer-events-none absolute -top-1/3 -left-1/4 h-[110%] w-[85%] rounded-full bg-[radial-gradient(circle,rgba(217,182,118,0.16),transparent_62%)] blur-3xl"
      />
      <div
        aria-hidden="true"
        className="cp-aurora pointer-events-none absolute -right-1/4 -bottom-1/2 h-[110%] w-[80%] rounded-full bg-[radial-gradient(circle,rgba(70,150,142,0.14),transparent_62%)] blur-3xl [animation-delay:-13s]"
      />
      <div
        aria-hidden="true"
        className="cp-noise pointer-events-none absolute inset-0 opacity-[0.055] mix-blend-overlay"
      />

      <div className="relative mx-auto max-w-4xl">
        <Reveal as="header" delay={0} from="translate-y-4">
          <nav aria-label="Breadcrumb" className="mb-7">
            <ol className="flex flex-wrap items-center gap-2.5 text-[12px] text-[#7E7A73]">
              {spec.breadcrumbs.map((crumb, index) => (
                <li key={crumb.label} className="flex items-center gap-2.5">
                  {index > 0 && (
                    <span
                      aria-hidden="true"
                      className="h-[3px] w-[3px] rounded-full bg-[#4A4741]"
                    />
                  )}
                  {crumb.href ? (
                    <Link
                      to={crumb.href}
                      className="transition-colors hover:text-[#D9B676]"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="text-[#C9C4BB]">{crumb.label}</span>
                  )}
                </li>
              ))}
            </ol>
          </nav>

          {spec.eyebrow && (
            <p className="mb-4 flex items-center gap-2.5 text-[10px] font-semibold tracking-[0.4em] text-[#D9B676] uppercase">
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 rotate-45 bg-[#D9B676]"
              />
              {spec.eyebrow}
            </p>
          )}

          <h1
            className="text-[clamp(2.25rem,5.5vw,3.5rem)] leading-[1.02] font-bold tracking-[-0.035em]"
            style={{ fontFamily: FONT_DISPLAY }}
          >
            {spec.title}
          </h1>

          {spec.subtitle && (
            <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-[#98938A]">
              {spec.subtitle}
            </p>
          )}
        </Reveal>

        {spec.error && (
          <div
            role="alert"
            className="mt-9 flex items-center gap-3 rounded-2xl border border-[#E2705C]/30 bg-[#E2705C]/10 px-5 py-4 backdrop-blur-xl"
          >
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#E2705C] shadow-[0_0_12px_#E2705C]"
            />
            <p className="text-[14px] text-[#F0B3A6]">{spec.error}</p>
          </div>
        )}

        <Form method="post" className="mt-11">
          <Reveal
            delay={140}
            from="translate-y-5"
            className="relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.045] shadow-[0_40px_90px_-40px_rgba(0,0,0,0.9)] backdrop-blur-2xl"
          >
            {/* Top highlight: the lit edge of the glass. */}
            <span
              aria-hidden="true"
              className="absolute inset-x-10 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(217,182,118,0.55),transparent)]"
            />

            <div className="divide-y divide-white/8">
              {spec.sections.map((section, index) => (
                <div
                  key={section.id}
                  className="grid gap-8 p-7 sm:p-10 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]"
                >
                  <div className="relative md:pl-8">
                    {/* Gold spine with a node per section. */}
                    <span
                      aria-hidden="true"
                      className="absolute top-1 left-0 hidden h-full w-px bg-[linear-gradient(180deg,rgba(217,182,118,0.5),transparent)] md:block"
                    />
                    <span
                      aria-hidden="true"
                      className="absolute top-1.5 -left-[3.5px] hidden h-2 w-2 rounded-full bg-[#D9B676] shadow-[0_0_14px_rgba(217,182,118,0.8)] md:block"
                    />
                    <p className="text-[10.5px] font-semibold tracking-[0.28em] text-[#D9B676]/80 uppercase">
                      {String(index + 1).padStart(2, '0')}
                    </p>
                    <h2
                      className="mt-2 text-[1.35rem] leading-tight font-bold tracking-[-0.02em]"
                      style={{ fontFamily: FONT_DISPLAY }}
                    >
                      {section.title}
                    </h2>
                    {section.description && (
                      <p className="mt-2.5 text-[13.5px] leading-relaxed text-[#8A857D]">
                        {section.description}
                      </p>
                    )}
                  </div>

                  <div className="grid gap-x-7 gap-y-6 sm:grid-cols-2">
                    {section.fields.map((field) => (
                      <NocturneField
                        key={field.name}
                        field={field}
                        sectionId={section.id}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-4 border-t border-white/8 bg-black/25 px-7 py-5 sm:px-10">
              <Link
                to={spec.cancelHref}
                className="rounded-full px-5 py-2.5 text-[13px] font-medium text-[#98938A] transition-colors hover:bg-white/6 hover:text-[#F3F0EA]"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={isSaving}
                className="rounded-full bg-[linear-gradient(180deg,#EBCF97,#C9A45F)] px-7 py-2.5 text-[13px] font-bold tracking-[0.01em] text-[#251C0C] shadow-[0_10px_30px_-10px_rgba(217,182,118,0.8)] transition hover:brightness-110 disabled:opacity-55 disabled:shadow-none"
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
