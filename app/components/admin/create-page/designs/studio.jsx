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
 * Studio — split canvas.
 *
 * Structure: a dark context rail owns the left third and holds the title, a
 * live card of the record being built, and — unusually — both actions. The
 * right two thirds are a quiet scrolling column where every field is a row
 * with its label beside the control rather than above it. Nothing is boxed.
 */

const CONTROL =
  'block w-full rounded-md border border-[var(--cpd-line)] bg-[var(--cpd-bg)] px-3 py-2 text-[14px] text-[var(--cpd-text)] outline-none transition duration-150 placeholder:text-[var(--cpd-faint)] hover:border-[var(--cpd-muted)] focus:border-[var(--cpd-accent)] focus:shadow-[0_0_0_3px_var(--cpd-accent-soft)]';

/**
 * @param {Object} props
 * @param {CreateFieldSpec} props.field
 * @param {string} props.sectionId
 * @param {(name: string, value: string) => void} props.onValueChange
 * @returns {React.ReactElement}
 */
function StudioRow({ field, sectionId, onValueChange }) {
  const isSelect = field.type === 'select';

  return (
    <div className="grid gap-2 py-5 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-8">
      <div className="pt-2">
        <label
          htmlFor={fieldDomId(sectionId, field.name)}
          className="text-[13.5px] leading-snug font-medium text-[var(--cpd-text)]"
        >
          {field.label}
        </label>
        <p className="mt-0.5 text-[11.5px] tracking-[0.04em] text-[var(--cpd-faint)] uppercase">
          {field.required ? 'Required' : 'Optional'}
        </p>
      </div>

      <div className="min-w-0">
        <div className="relative">
          <FieldControl
            field={field}
            sectionId={sectionId}
            onValueChange={onValueChange}
            className={isSelect ? `${CONTROL} appearance-none pr-9` : CONTROL}
          />
          {isSelect && (
            <svg
              aria-hidden="true"
              viewBox="0 0 12 8"
              className="pointer-events-none absolute top-1/2 right-3 h-2 w-3 -translate-y-1/2 text-[var(--cpd-muted)]"
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
          <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--cpd-muted)]">
            {field.hint}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Live card of the record as it is being described.
 *
 * @param {Object} props
 * @param {CreatePageSpec} props.spec
 * @param {Record<string, string>} props.values
 * @returns {React.ReactElement}
 */
function RailPreview({ spec, values }) {
  const fields = allFields(spec);
  const primary = fields[0];
  const name = values[primary?.name] ?? '';
  const slug = spec.preview
    ? slugify(values[spec.preview.slugField] ?? '')
    : '';
  const parentField = fields.find((field) => field.type === 'select');
  const selected = parentField ? (values[parentField.name] ?? '') : '';
  const parentLabel = selected
    ? (parentField?.options?.find((option) => option.value === selected)
        ?.label ?? '')
    : '';

  return (
    <div className="rounded-xl border border-[var(--cpd-rail-line)] bg-[var(--cpd-rail-panel)] p-4">
      <p className="text-[10px] font-semibold tracking-[0.2em] text-[var(--cpd-rail-muted)] uppercase">
        Preview
      </p>

      <div className="mt-3 flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--cpd-rail-accent)] text-[15px] font-bold text-[#2a0b06]"
        >
          {(name.trim()[0] ?? '?').toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold text-[var(--cpd-rail-text)]">
            {name.trim() || 'Untitled'}
          </p>
          <p className="truncate text-[12px] text-[var(--cpd-rail-muted)]">
            {spec.preview?.pathPrefix ?? '/'}
            {slug || '…'}
          </p>
        </div>
      </div>

      {parentField && (
        <p className="mt-3 border-t border-[var(--cpd-rail-line)] pt-3 text-[12px] text-[var(--cpd-rail-muted)]">
          {parentField.label}:{' '}
          <span className="text-[var(--cpd-rail-text)]">
            {parentLabel || 'None (root)'}
          </span>
        </p>
      )}
    </div>
  );
}

/**
 * Studio create-page design.
 *
 * @param {Object} props
 * @param {CreatePageSpec} props.spec
 * @param {boolean} props.isSaving
 * @returns {React.ReactElement}
 */
export default function StudioCreatePage({ spec, isSaving }) {
  const [values, setValues] = useState(() => initialValues(spec));

  /**
   * @param {string} name
   * @param {string} value
   */
  function handleValueChange(name, value) {
    setValues((previous) => ({ ...previous, [name]: value }));
  }

  return (
    <div
      className="cpd-studio overflow-hidden rounded-2xl border border-[var(--cpd-line)] bg-[var(--cpd-bg)] text-[var(--cpd-text)]"
      style={{ fontFamily: 'var(--cpd-font-body)' }}
    >
      <Form method="post" className="grid lg:grid-cols-[21rem_minmax(0,1fr)]">
        {/* Context rail — title, preview, and both actions. */}
        <aside className="flex flex-col justify-between gap-10 bg-[var(--cpd-rail-bg)] p-7 text-[var(--cpd-rail-text)] lg:min-h-[38rem] lg:p-8">
          <Reveal delay={0} from="translateX(-10px)">
            <nav aria-label="Breadcrumb">
              <ol className="flex flex-wrap items-center gap-1.5 text-[12px] text-[var(--cpd-rail-muted)]">
                {spec.breadcrumbs.map((crumb, index) => (
                  <li key={crumb.label} className="flex items-center gap-1.5">
                    {index > 0 && <span aria-hidden="true">›</span>}
                    {crumb.href ? (
                      <Link
                        to={crumb.href}
                        className="transition-colors hover:text-[var(--cpd-rail-text)]"
                      >
                        {crumb.label}
                      </Link>
                    ) : (
                      <span className="text-[var(--cpd-rail-text)]">
                        {crumb.label}
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            </nav>

            {spec.eyebrow && (
              <p className="mt-7 flex items-center gap-2 text-[10px] font-semibold tracking-[0.28em] text-[var(--cpd-rail-accent)] uppercase">
                <span
                  aria-hidden="true"
                  className="h-2 w-2 rounded-full bg-[var(--cpd-rail-accent)]"
                />
                {spec.eyebrow}
              </p>
            )}

            <h1
              className="mt-3 text-[2.1rem] leading-[1.05] font-bold tracking-[-0.03em]"
              style={{ fontFamily: 'var(--cpd-font-display)' }}
            >
              {spec.title}
            </h1>
            {spec.subtitle && (
              <p className="mt-3 text-[14px] leading-relaxed text-[var(--cpd-rail-muted)]">
                {spec.subtitle}
              </p>
            )}

            <div className="mt-7">
              <RailPreview spec={spec} values={values} />
            </div>
          </Reveal>

          <Reveal delay={220} from="translateX(-10px)" className="space-y-2.5">
            <button
              type="submit"
              disabled={isSaving}
              className="w-full rounded-lg bg-[var(--cpd-accent)] px-5 py-3 text-[14px] font-semibold text-[var(--cpd-accent-fg)] transition hover:brightness-110 disabled:opacity-55"
            >
              {isSaving
                ? (spec.submittingLabel ?? 'Saving…')
                : spec.submitLabel}
            </button>
            <Link
              to={spec.cancelHref}
              className="block w-full rounded-lg border border-[var(--cpd-rail-line)] px-5 py-3 text-center text-[14px] font-medium text-[var(--cpd-rail-muted)] transition-colors hover:text-[var(--cpd-rail-text)]"
            >
              Cancel
            </Link>
          </Reveal>
        </aside>

        {/* Field column — rows, not cards. */}
        <div className="p-7 lg:p-10">
          {spec.error && (
            <div
              role="alert"
              className="mb-7 rounded-lg border-l-[3px] border-[var(--cpd-danger)] bg-[var(--cpd-danger-soft)] px-4 py-3"
            >
              <p className="text-[13.5px] font-medium text-[var(--cpd-danger)]">
                {spec.error}
              </p>
            </div>
          )}

          {spec.sections.map((section, index) => (
            <Reveal
              key={section.id}
              delay={110 + index * 90}
              from="translateY(10px)"
              className={index > 0 ? 'mt-10' : ''}
            >
              <div className="flex items-baseline gap-3 border-b border-[var(--cpd-line)] pb-3">
                <h2 className="text-[11px] font-semibold tracking-[0.16em] text-[var(--cpd-muted)] uppercase">
                  {section.title}
                </h2>
                {section.description && (
                  <p className="min-w-0 flex-1 truncate text-[12.5px] text-[var(--cpd-faint)]">
                    {section.description}
                  </p>
                )}
              </div>

              <div className="divide-y divide-[var(--cpd-line)]">
                {section.fields.map((field) => (
                  <StudioRow
                    key={field.name}
                    field={field}
                    sectionId={section.id}
                    onValueChange={handleValueChange}
                  />
                ))}
              </div>
            </Reveal>
          ))}
        </div>
      </Form>
    </div>
  );
}
