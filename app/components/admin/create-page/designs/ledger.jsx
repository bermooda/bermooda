import { useState } from 'react';
import { Form, Link } from 'react-router';

import FieldControl from '#/components/admin/create-page/control';
import Reveal from '#/components/admin/create-page/reveal';
import {
  allFields,
  fieldDomId,
  initialValues,
  slugify,
} from '#/components/admin/create-page/spec';

/** @typedef {import('#/components/admin/create-page/spec').CreatePageSpec} CreatePageSpec */
/** @typedef {import('#/components/admin/create-page/spec').CreateFieldSpec} CreateFieldSpec */

/*
 * Ledger — dense record sheet.
 *
 * Structure: actions sit in a sticky toolbar at the top right, never at the
 * bottom. The body is a two-column split with a metadata column on the left
 * and the record itself on the right, rendered as table rows whose labels are
 * right-aligned inside a tinted gutter. Rows are tight; nothing is padded for
 * comfort. Built for operators who fill in twenty of these a day.
 */

const MONO = { fontFamily: 'var(--cpd-font-mono)' };

const CONTROL =
  'block w-full rounded-[3px] border border-[var(--cpd-line)] bg-[var(--cpd-panel)] px-2.5 py-1.5 text-[13px] text-[var(--cpd-text)] outline-none transition placeholder:text-[var(--cpd-faint)] hover:border-[var(--cpd-line-strong)] focus:border-[var(--cpd-accent)] focus:shadow-[0_0_0_2px_var(--cpd-accent-soft)]';

/**
 * @param {Object} props
 * @param {CreateFieldSpec} props.field
 * @param {string} props.sectionId
 * @param {(name: string, value: string) => void} props.onValueChange
 * @returns {React.ReactElement}
 */
function LedgerRow({ field, sectionId, onValueChange }) {
  const isSelect = field.type === 'select';

  return (
    <div className="grid border-b border-[var(--cpd-line)] last:border-b-0 sm:grid-cols-[12rem_minmax(0,1fr)]">
      <div className="flex items-start justify-start border-[var(--cpd-line)] bg-[var(--cpd-panel-2)] px-3 py-2.5 sm:justify-end sm:border-r">
        <label
          htmlFor={fieldDomId(sectionId, field.name)}
          className="text-[12.5px] leading-6 text-[var(--cpd-muted)] sm:text-right"
        >
          {field.label}
          {field.required && (
            <span
              aria-hidden="true"
              className="ml-1 text-[var(--cpd-danger)]"
              title="Required"
            >
              •
            </span>
          )}
        </label>
      </div>

      <div className="px-3 py-2">
        <div className="relative max-w-lg">
          <FieldControl
            field={field}
            sectionId={sectionId}
            onValueChange={onValueChange}
            className={isSelect ? `${CONTROL} appearance-none pr-8` : CONTROL}
          />
          {isSelect && (
            <svg
              aria-hidden="true"
              viewBox="0 0 12 8"
              className="pointer-events-none absolute top-1/2 right-2.5 h-2 w-3 -translate-y-1/2 text-[var(--cpd-muted)]"
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
          <p className="mt-1.5 text-[11.5px] text-[var(--cpd-faint)]">
            {field.hint}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Ledger create-page design.
 *
 * @param {Object} props
 * @param {CreatePageSpec} props.spec
 * @param {boolean} props.isSaving
 * @returns {React.ReactElement}
 */
export default function LedgerCreatePage({ spec, isSaving }) {
  const [values, setValues] = useState(() => initialValues(spec));
  const fields = allFields(spec);
  const filled = fields.filter((field) => (values[field.name] ?? '').trim());
  const slug = spec.preview
    ? slugify(values[spec.preview.slugField] ?? '')
    : '';
  const parentField = fields.find((field) => field.type === 'select');
  const parentValue = parentField ? (values[parentField.name] ?? '') : '';
  const parentLabel = parentValue
    ? (parentField?.options?.find((option) => option.value === parentValue)
        ?.label ?? '')
    : '';

  /**
   * @param {string} name
   * @param {string} value
   */
  function handleValueChange(name, value) {
    setValues((previous) => ({ ...previous, [name]: value }));
  }

  return (
    <div
      className="cpd-ledger overflow-hidden rounded-md border border-[var(--cpd-line)] bg-[var(--cpd-bg)] text-[var(--cpd-text)]"
      style={{ fontFamily: 'var(--cpd-font-body)' }}
    >
      <Form method="post">
        {/* Toolbar — the actions live here, not in a footer. */}
        <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--cpd-line)] bg-[var(--cpd-panel-2)] px-4 py-2.5">
          <div className="flex min-w-0 items-baseline gap-3">
            <nav aria-label="Breadcrumb" className="min-w-0">
              <ol
                className="flex min-w-0 items-center gap-1.5 text-[11.5px] text-[var(--cpd-muted)]"
                style={MONO}
              >
                {spec.breadcrumbs.map((crumb, index) => (
                  <li key={crumb.label} className="flex items-center gap-1.5">
                    {index > 0 && (
                      <span
                        aria-hidden="true"
                        className="text-[var(--cpd-faint)]"
                      >
                        /
                      </span>
                    )}
                    {crumb.href ? (
                      <Link
                        to={crumb.href}
                        className="truncate transition-colors hover:text-[var(--cpd-accent)]"
                      >
                        {crumb.label}
                      </Link>
                    ) : (
                      <span className="truncate text-[var(--cpd-text)]">
                        {crumb.label}
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            </nav>
            <span
              aria-hidden="true"
              className="hidden h-3.5 w-px bg-[var(--cpd-line-strong)] sm:block"
            />
            <h1 className="hidden truncate text-[13px] font-semibold sm:block">
              {spec.title}
            </h1>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Link
              to={spec.cancelHref}
              className="rounded-[3px] border border-[var(--cpd-line-strong)] px-3 py-1.5 text-[12.5px] font-medium text-[var(--cpd-muted)] transition-colors hover:text-[var(--cpd-text)]"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-[3px] bg-[var(--cpd-accent)] px-3.5 py-1.5 text-[12.5px] font-semibold text-[var(--cpd-accent-fg)] transition hover:brightness-110 disabled:opacity-55"
            >
              {isSaving
                ? (spec.submittingLabel ?? 'Saving…')
                : spec.submitLabel}
            </button>
          </div>
        </div>

        {spec.error && (
          <div
            role="alert"
            className="flex items-center gap-2.5 border-b border-[var(--cpd-line)] bg-[var(--cpd-danger-soft)] px-4 py-2.5"
          >
            <span
              className="rounded-[3px] bg-[var(--cpd-danger)] px-1.5 py-px text-[10px] font-bold tracking-[0.08em] text-white uppercase"
              style={MONO}
            >
              Error
            </span>
            <p className="text-[12.5px] text-[var(--cpd-danger)]">
              {spec.error}
            </p>
          </div>
        )}

        <div className="grid lg:grid-cols-[15rem_minmax(0,1fr)]">
          {/* Metadata column */}
          <aside className="border-b border-[var(--cpd-line)] bg-[var(--cpd-panel-2)] p-4 lg:border-r lg:border-b-0">
            <Reveal delay={0} from="translateY(6px)">
              <h2 className="text-[10.5px] font-semibold tracking-[0.16em] text-[var(--cpd-muted)] uppercase">
                Destination
              </h2>
              <ul className="mt-3 space-y-1 text-[12.5px]" style={MONO}>
                <li className="text-[var(--cpd-faint)]">Root</li>
                {parentLabel && (
                  <li className="pl-3 text-[var(--cpd-muted)]">
                    └ {parentLabel}
                  </li>
                )}
                <li
                  className={`text-[var(--cpd-accent)] ${parentLabel ? 'pl-6' : 'pl-3'}`}
                >
                  └ {(values[fields[0]?.name] ?? '').trim() || 'Untitled'}
                </li>
              </ul>

              {spec.preview && (
                <>
                  <h2 className="mt-6 text-[10.5px] font-semibold tracking-[0.16em] text-[var(--cpd-muted)] uppercase">
                    URL
                  </h2>
                  <p
                    className="mt-2 text-[12px] break-all text-[var(--cpd-text)]"
                    style={MONO}
                  >
                    <span className="text-[var(--cpd-faint)]">
                      {spec.preview.pathPrefix ?? '/'}
                    </span>
                    {slug || (
                      <span className="cp-caret text-[var(--cpd-faint)]">
                        ▍
                      </span>
                    )}
                  </p>
                </>
              )}

              <h2 className="mt-6 text-[10.5px] font-semibold tracking-[0.16em] text-[var(--cpd-muted)] uppercase">
                Completion
              </h2>
              <p className="mt-2 text-[12.5px] text-[var(--cpd-muted)]">
                <span
                  className="text-[15px] text-[var(--cpd-text)]"
                  style={MONO}
                >
                  {filled.length}
                </span>
                {' / '}
                <span style={MONO}>{fields.length}</span> fields
              </p>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-[var(--cpd-line)]">
                <div
                  className="h-full rounded-full bg-[var(--cpd-accent)] transition-[width] duration-300"
                  style={{
                    width: `${(filled.length / Math.max(fields.length, 1)) * 100}%`,
                  }}
                />
              </div>
            </Reveal>
          </aside>

          {/* Record sheet */}
          <div>
            {spec.sections.map((section, index) => (
              <Reveal
                key={section.id}
                delay={70 + index * 60}
                from="translateY(6px)"
              >
                <div className="flex items-baseline gap-2.5 border-b border-[var(--cpd-line)] bg-[var(--cpd-panel-2)] px-3 py-2">
                  <span
                    className="text-[11px] text-[var(--cpd-accent)]"
                    style={MONO}
                  >
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <h2 className="text-[11px] font-semibold tracking-[0.14em] text-[var(--cpd-text)] uppercase">
                    {section.title}
                  </h2>
                  {section.description && (
                    <p className="min-w-0 flex-1 truncate text-[11.5px] text-[var(--cpd-faint)]">
                      {section.description}
                    </p>
                  )}
                </div>

                {section.fields.map((field) => (
                  <LedgerRow
                    key={field.name}
                    field={field}
                    sectionId={section.id}
                    onValueChange={handleValueChange}
                  />
                ))}
              </Reveal>
            ))}
          </div>
        </div>
      </Form>
    </div>
  );
}
