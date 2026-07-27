import { Form, Link } from 'react-router';

import FieldControl from '#/components/admin/create-page/control';
import Reveal from '#/components/admin/create-page/reveal';
import { allFields, fieldDomId } from '#/components/admin/create-page/spec';

/** @typedef {import('#/components/admin/create-page/spec').CreatePageSpec} CreatePageSpec */
/** @typedef {import('#/components/admin/create-page/spec').CreateFieldSpec} CreateFieldSpec */

/*
 * Console — the form as a command sheet.
 *
 * Structure: no cards and no grid. A numbered gutter runs down the left edge
 * and every field is one full-width line of `key = value` at a narrow reading
 * measure. Section titles are comment lines. Actions live in a command bar
 * pinned to the bottom of the sheet, keyboard-first.
 */

const MONO = { fontFamily: 'var(--cpd-font-mono)' };

const CONTROL =
  'cp-dotted-rule block w-full rounded-none border-0 bg-transparent px-0 pt-0.5 pb-1.5 text-[14px] text-[var(--cpd-text)] outline-none transition-colors placeholder:text-[var(--cpd-faint)] focus:bg-[var(--cpd-accent-soft)]';

/**
 * One numbered line of the sheet.
 *
 * @param {Object} props
 * @param {number|string} props.number Gutter marker
 * @param {React.ReactNode} props.children
 * @param {string} [props.className]
 * @returns {React.ReactElement}
 */
function Line({ number, children, className = '' }) {
  return (
    <div className={`flex gap-4 sm:gap-6 ${className}`}>
      <span
        aria-hidden="true"
        className="w-7 shrink-0 pt-0.5 text-right text-[11px] text-[var(--cpd-faint)] tabular-nums select-none"
        style={MONO}
      >
        {number}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/**
 * @param {Object} props
 * @param {CreateFieldSpec} props.field
 * @param {string} props.sectionId
 * @returns {React.ReactElement}
 */
function ConsoleField({ field, sectionId }) {
  const isSelect = field.type === 'select';

  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-baseline sm:gap-3">
      <label
        htmlFor={fieldDomId(sectionId, field.name)}
        className="shrink-0 text-[13px] text-[var(--cpd-accent)] sm:w-40"
        style={MONO}
      >
        {field.name}
        {field.required && (
          <span className="text-[var(--cpd-danger)]" aria-hidden="true">
            *
          </span>
        )}
        <span className="ml-2 text-[var(--cpd-faint)]">=</span>
      </label>

      <div className="relative min-w-0 flex-1">
        <FieldControl
          field={field}
          sectionId={sectionId}
          className={
            isSelect ? `${CONTROL} appearance-none pr-6` : `${CONTROL}`
          }
        />
        {isSelect && (
          <svg
            aria-hidden="true"
            viewBox="0 0 12 8"
            className="pointer-events-none absolute right-0 bottom-2.5 h-2 w-3 text-[var(--cpd-accent)]"
          >
            <path
              d="M1 1l5 5 5-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        )}
      </div>
    </div>
  );
}

/**
 * Console create-page design.
 *
 * @param {Object} props
 * @param {CreatePageSpec} props.spec
 * @param {boolean} props.isSaving
 * @returns {React.ReactElement}
 */
export default function ConsoleCreatePage({ spec, isSaving }) {
  const fields = allFields(spec);
  const requiredCount = fields.filter((field) => field.required).length;
  const path = spec.breadcrumbs.map((crumb) => crumb.label.toLowerCase());
  let line = 0;

  return (
    <div
      className="cpd-console overflow-hidden rounded-lg border border-[var(--cpd-line)] bg-[var(--cpd-bg)] text-[var(--cpd-text)]"
      style={{ fontFamily: 'var(--cpd-font-body)' }}
    >
      {/* Window strip: location on the left, escape hatch on the right. */}
      <div className="flex items-center justify-between gap-4 border-b border-[var(--cpd-line)] bg-[var(--cpd-panel-2)] px-4 py-2.5">
        <nav aria-label="Breadcrumb" className="min-w-0">
          <ol
            className="flex min-w-0 items-center gap-1.5 text-[11.5px] text-[var(--cpd-muted)]"
            style={MONO}
          >
            <li aria-hidden="true" className="text-[var(--cpd-accent)]">
              ~/
            </li>
            {spec.breadcrumbs.map((crumb, index) => (
              <li key={crumb.label} className="flex items-center gap-1.5">
                {index > 0 && (
                  <span aria-hidden="true" className="text-[var(--cpd-faint)]">
                    /
                  </span>
                )}
                {crumb.href ? (
                  <Link
                    to={crumb.href}
                    className="truncate transition-colors hover:text-[var(--cpd-accent)]"
                  >
                    {path[index]}
                  </Link>
                ) : (
                  <span className="truncate text-[var(--cpd-text)]">
                    {path[index]}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </nav>

        <Link
          to={spec.cancelHref}
          className="shrink-0 rounded border border-[var(--cpd-line-strong)] px-2 py-0.5 text-[10.5px] text-[var(--cpd-muted)] transition-colors hover:border-[var(--cpd-danger)] hover:text-[var(--cpd-danger)]"
          style={MONO}
        >
          esc
        </Link>
      </div>

      <Form method="post">
        {/* Narrow measure hugging the left edge — a sheet, not a centred page. */}
        <div className="max-w-3xl px-4 py-9 sm:px-8 sm:py-11">
          <Reveal delay={0} from="translate-y-2">
            <Line number="">
              <h1 className="text-[22px] leading-tight font-semibold tracking-[-0.01em]">
                <span
                  aria-hidden="true"
                  className="mr-2 text-[var(--cpd-accent)]"
                  style={MONO}
                >
                  ❯
                </span>
                {spec.title}
              </h1>
              {spec.subtitle && (
                <p
                  className="mt-2 pl-6 text-[13px] leading-relaxed text-[var(--cpd-muted)]"
                  style={MONO}
                >
                  # {spec.subtitle}
                </p>
              )}
            </Line>
          </Reveal>

          {spec.error && (
            <div
              role="alert"
              className="mt-7 border-l-2 border-[var(--cpd-danger)] bg-[var(--cpd-danger-soft)] py-2 pr-3 pl-4"
            >
              <p className="text-[13px] text-[var(--cpd-danger)]" style={MONO}>
                <span aria-hidden="true">! </span>
                {spec.error}
              </p>
            </div>
          )}

          <div className="mt-9 space-y-8">
            {spec.sections.map((section, index) => (
              <Reveal
                key={section.id}
                delay={90 + index * 80}
                from="translate-y-2"
                className="space-y-4"
              >
                <Line number="">
                  <p
                    className="text-[12px] tracking-[0.08em] text-[var(--cpd-muted)] uppercase"
                    style={MONO}
                  >
                    ## {String(index + 1).padStart(2, '0')} {section.title}
                  </p>
                  {section.description && (
                    <p
                      className="mt-1 text-[12px] leading-relaxed text-[var(--cpd-faint)]"
                      style={MONO}
                    >
                      # {section.description}
                    </p>
                  )}
                </Line>

                {section.fields.map((field) => {
                  line += 1;
                  return (
                    <div key={field.name} className="space-y-1">
                      <Line number={String(line).padStart(2, '0')}>
                        <ConsoleField field={field} sectionId={section.id} />
                      </Line>
                      {field.hint && (
                        <Line number="">
                          <p
                            className="text-[11.5px] text-[var(--cpd-faint)] sm:pl-[10.75rem]"
                            style={MONO}
                          >
                            # {field.hint}
                          </p>
                        </Line>
                      )}
                    </div>
                  );
                })}
              </Reveal>
            ))}
          </div>
        </div>

        {/* Command bar: the only place an action can be triggered. */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--cpd-line)] bg-[var(--cpd-panel-2)] px-4 py-3 sm:px-8">
          <p className="text-[11.5px] text-[var(--cpd-muted)]" style={MONO}>
            {fields.length} fields · {requiredCount} required ·{' '}
            <span className="text-[var(--cpd-accent)]">
              {isSaving ? 'running' : 'ready'}
            </span>
            {!isSaving && (
              <span
                className="cp-caret ml-0.5 text-[var(--cpd-accent)]"
                aria-hidden="true"
              >
                _
              </span>
            )}
          </p>

          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-2.5 rounded bg-[var(--cpd-accent)] px-4 py-1.5 text-[12.5px] font-medium text-[var(--cpd-accent-fg)] transition hover:brightness-110 disabled:opacity-55"
            style={MONO}
          >
            <span
              aria-hidden="true"
              className="rounded-sm border border-current px-1.5 py-px text-[10px] opacity-60"
            >
              ⏎
            </span>
            {isSaving ? (spec.submittingLabel ?? 'running…') : spec.submitLabel}
          </button>
        </div>
      </Form>
    </div>
  );
}
