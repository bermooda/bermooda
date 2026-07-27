import { Form, Link } from 'react-router';

import FieldControl from '#/components/admin/create-page/control';
import Reveal from '#/components/admin/create-page/reveal';
import { allFields, fieldDomId } from '#/components/admin/create-page/spec';

/** @typedef {import('#/components/admin/create-page/spec').CreatePageSpec} CreatePageSpec */
/** @typedef {import('#/components/admin/create-page/spec').CreateFieldSpec} CreateFieldSpec */

/*
 * Canvas — editorial composition.
 *
 * Structure: nothing is boxed or gridded. Section titles are set vertically
 * down the left margin, fields flow inline and ragged-right like words on a
 * line, sized to their content rather than to a column, and the submit action
 * is a full-height vertical bar welded to the right edge of the sheet.
 */

/**
 * Inline measure per field type — this is what makes the flow ragged instead
 * of columnar.
 *
 * @param {CreateFieldSpec} field
 * @returns {string}
 */
function fieldWidth(field) {
  if (field.type === 'textarea') return 'w-full';
  if (field.type === 'select') return 'w-full sm:w-[19rem]';
  return 'w-full sm:w-[23rem]';
}

const CONTROL =
  'block w-full rounded-none border-0 border-b border-[var(--cpd-line-strong)] bg-transparent px-0 pb-2 text-[19px] text-[var(--cpd-text)] outline-none transition-colors placeholder:text-[var(--cpd-faint)] focus:border-b-2 focus:pb-[7px]';

/**
 * @param {Object} props
 * @param {CreateFieldSpec} props.field
 * @param {string} props.sectionId
 * @returns {React.ReactElement}
 */
function CanvasField({ field, sectionId }) {
  const isSelect = field.type === 'select';

  return (
    <div className={fieldWidth(field)}>
      <label
        htmlFor={fieldDomId(sectionId, field.name)}
        className="mb-2 block text-[10px] font-bold tracking-[0.26em] text-[var(--cpd-muted)] uppercase"
      >
        {field.label}
        {field.required && (
          <span className="ml-1.5 text-[var(--cpd-signal)]" aria-hidden="true">
            ●
          </span>
        )}
      </label>

      <div className="relative">
        <FieldControl
          field={field}
          sectionId={sectionId}
          className={isSelect ? `${CONTROL} appearance-none pr-7` : CONTROL}
        />
        {isSelect && (
          <svg
            aria-hidden="true"
            viewBox="0 0 12 8"
            className="pointer-events-none absolute right-0 bottom-3.5 h-2 w-3 text-[var(--cpd-signal)]"
          >
            <path
              d="M1 1l5 5 5-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
            />
          </svg>
        )}
      </div>

      {field.hint && (
        <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--cpd-muted)] italic">
          {field.hint}
        </p>
      )}
    </div>
  );
}

/**
 * Canvas create-page design.
 *
 * @param {Object} props
 * @param {CreatePageSpec} props.spec
 * @param {boolean} props.isSaving
 * @returns {React.ReactElement}
 */
export default function CanvasCreatePage({ spec, isSaving }) {
  const fields = allFields(spec);

  return (
    <div
      className="cpd-canvas cp-grain relative overflow-hidden bg-[var(--cpd-bg)] text-[var(--cpd-text)]"
      style={{ fontFamily: 'var(--cpd-font-body)' }}
    >
      <Form method="post" className="flex">
        <div className="min-w-0 flex-1 px-5 py-10 sm:px-10 sm:py-14">
          <Reveal delay={0} from="translate-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-3">
              <nav aria-label="Breadcrumb">
                <ol className="flex flex-wrap items-center gap-2 text-[11px] font-bold tracking-[0.2em] text-[var(--cpd-muted)] uppercase">
                  {spec.breadcrumbs.map((crumb, index) => (
                    <li key={crumb.label} className="flex items-center gap-2">
                      {index > 0 && (
                        <span
                          aria-hidden="true"
                          className="text-[var(--cpd-faint)]"
                        >
                          —
                        </span>
                      )}
                      {crumb.href ? (
                        <Link
                          to={crumb.href}
                          className="transition-colors hover:text-[var(--cpd-signal)]"
                        >
                          {crumb.label}
                        </Link>
                      ) : (
                        <span className="text-[var(--cpd-text)]">
                          {crumb.label}
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              </nav>
              {spec.eyebrow && (
                <p className="text-[11px] font-bold tracking-[0.2em] text-[var(--cpd-signal)] uppercase">
                  {spec.eyebrow}
                </p>
              )}
            </div>

            {/* Masthead: display type sitting on a full-bleed rule. */}
            <h1
              className="mt-8 -mb-1 text-[clamp(3rem,10vw,6.5rem)] leading-[0.85] tracking-[-0.03em]"
              style={{ fontFamily: 'var(--cpd-font-display)' }}
            >
              {spec.title}
            </h1>
            <div className="mt-6 border-t-2 border-[var(--cpd-line-strong)]" />
            {spec.subtitle && (
              <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-[var(--cpd-muted)]">
                {spec.subtitle}
              </p>
            )}
          </Reveal>

          {spec.error && (
            <div
              role="alert"
              className="mt-9 flex items-baseline gap-3 border-l-4 border-[var(--cpd-danger)] bg-[var(--cpd-danger-soft)] py-3 pr-4 pl-4"
            >
              <span className="text-[10px] font-bold tracking-[0.2em] text-[var(--cpd-danger)] uppercase">
                Note
              </span>
              <p className="text-[15px] text-[var(--cpd-danger)] italic">
                {spec.error}
              </p>
            </div>
          )}

          <div className="mt-12 space-y-14">
            {spec.sections.map((section, index) => (
              <Reveal
                key={section.id}
                delay={120 + index * 100}
                from="translate-y-3"
                className="flex gap-6 sm:gap-10"
              >
                {/* Section title, set down the margin. */}
                <div className="hidden shrink-0 sm:block">
                  <div className="flex h-full flex-col items-center gap-4">
                    <span
                      className="text-[13px] tracking-[0.1em] text-[var(--cpd-signal)]"
                      style={{ fontFamily: 'var(--cpd-font-display)' }}
                    >
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    {/* Rotated 180° so the spine label reads bottom-to-top. */}
                    <h2 className="rotate-180 text-[11px] font-bold tracking-[0.3em] whitespace-nowrap text-[var(--cpd-text)] uppercase [text-orientation:mixed] [writing-mode:vertical-rl]">
                      {section.title}
                    </h2>
                    <span
                      aria-hidden="true"
                      className="w-px flex-1 bg-[var(--cpd-line)]"
                    />
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <h2 className="mb-5 text-[11px] font-bold tracking-[0.3em] text-[var(--cpd-text)] uppercase sm:hidden">
                    {section.title}
                  </h2>
                  {section.description && (
                    <p className="mb-8 max-w-md text-[14px] leading-relaxed text-[var(--cpd-muted)] italic">
                      {section.description}
                    </p>
                  )}

                  {/* Ragged inline flow — fields wrap like words, not cells. */}
                  <div className="flex flex-wrap items-end gap-x-12 gap-y-9">
                    {section.fields.map((field) => (
                      <CanvasField
                        key={field.name}
                        field={field}
                        sectionId={section.id}
                      />
                    ))}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          <div className="mt-14 flex items-center gap-6 border-t border-[var(--cpd-line)] pt-6">
            <Link
              to={spec.cancelHref}
              className="text-[11px] font-bold tracking-[0.2em] text-[var(--cpd-muted)] uppercase underline underline-offset-[6px] transition-colors hover:text-[var(--cpd-text)]"
            >
              Discard
            </Link>
            <p className="text-[12.5px] text-[var(--cpd-faint)] italic">
              {fields.filter((field) => field.required).length} of{' '}
              {fields.length} fields required.
            </p>
          </div>
        </div>

        {/* Action rail: the submit control is the right edge of the page. */}
        <button
          type="submit"
          disabled={isSaving}
          className="group relative flex w-14 shrink-0 items-center justify-center bg-[var(--cpd-accent)] text-[var(--cpd-accent-fg)] transition-[width] duration-300 hover:w-16 disabled:opacity-55 sm:w-16 sm:hover:w-[4.5rem]"
        >
          <span className="rotate-180 text-[11px] font-bold tracking-[0.32em] whitespace-nowrap uppercase [text-orientation:mixed] [writing-mode:vertical-rl]">
            {isSaving ? (spec.submittingLabel ?? 'Saving…') : spec.submitLabel}
          </span>
          <span
            aria-hidden="true"
            className="absolute bottom-8 text-[15px] transition-transform duration-300 group-hover:translate-y-1"
          >
            ↓
          </span>
        </button>
      </Form>
    </div>
  );
}
