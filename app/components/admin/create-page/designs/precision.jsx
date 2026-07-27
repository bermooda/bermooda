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
 * Precision — product craft.
 * Cool near-white, tight vertical rhythm, monospace metadata, and a sticky
 * rail that mirrors what you are typing back as the record it will become.
 * The differentiator is the live preview, not the chrome.
 *
 * bg #FAFAFB · panel #FFFFFF · rule #E6E7EB · ink #0B0C0E
 * muted #6E7278 · signal #2B6CF6
 */

const FONT_BODY = "'Geist', ui-sans-serif, system-ui, sans-serif";
const FONT_MONO = "'Geist Mono', ui-monospace, SFMono-Regular, monospace";

const CONTROL =
  'block w-full rounded-lg border border-[#E0E1E6] bg-white px-3 py-2 text-[14px] text-[#0B0C0E] shadow-[0_1px_2px_rgba(11,12,14,0.05)] outline-none transition duration-150 placeholder:text-[#A6A9B0] hover:border-[#CDCFD6] focus:border-[#2B6CF6] focus:shadow-[0_0_0_3px_rgba(43,108,246,0.14)]';

/**
 * @param {Object} props
 * @param {CreateFieldSpec} props.field
 * @param {string} props.sectionId
 * @param {(name: string, value: string) => void} props.onValueChange
 * @returns {React.ReactElement}
 */
function PrecisionField({ field, sectionId, onValueChange }) {
  const isSelect = field.type === 'select';

  return (
    <div className={field.full ? 'sm:col-span-2' : ''}>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label
          htmlFor={fieldDomId(sectionId, field.name)}
          className="text-[13px] font-medium text-[#0B0C0E]"
        >
          {field.label}
        </label>
        {!field.required && (
          <span
            className="text-[10.5px] tracking-[0.06em] text-[#9498A0] uppercase"
            style={{ fontFamily: FONT_MONO }}
          >
            optional
          </span>
        )}
      </div>

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
            className="pointer-events-none absolute top-1/2 right-3 h-2 w-3 -translate-y-1/2 text-[#8A8E96]"
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
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#6E7278]">
          {field.hint}
        </p>
      )}
    </div>
  );
}

/**
 * Sticky rail mirroring the form state as the record it will create.
 *
 * @param {Object} props
 * @param {CreatePageSpec} props.spec
 * @param {Record<string, string>} props.values
 * @returns {React.ReactElement}
 */
function PreviewRail({ spec, values }) {
  const preview = spec.preview;
  const fields = allFields(spec);
  const summaryNames = preview?.summaryFields ?? fields.map((f) => f.name);
  const slug = preview ? slugify(values[preview.slugField] ?? '') : '';

  /**
   * Display value for a field, resolving select ids to their option labels.
   *
   * @param {CreateFieldSpec} field
   * @returns {string}
   */
  function displayValue(field) {
    const raw = values[field.name] ?? '';
    if (!raw) return '';
    if (field.type === 'select') {
      return field.options?.find((o) => o.value === raw)?.label ?? raw;
    }
    return raw;
  }

  return (
    <aside className="lg:sticky lg:top-6">
      <div className="overflow-hidden rounded-xl border border-[#E6E7EB] bg-white shadow-[0_1px_2px_rgba(11,12,14,0.04)]">
        <div className="flex items-center justify-between border-b border-[#EEEFF2] px-4 py-2.5">
          <span
            className="text-[10.5px] tracking-[0.12em] text-[#6E7278] uppercase"
            style={{ fontFamily: FONT_MONO }}
          >
            Preview
          </span>
          <span className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full bg-[#2B6CF6]"
            />
            <span className="text-[11px] text-[#9498A0]">live</span>
          </span>
        </div>

        {preview && (
          <div className="border-b border-[#EEEFF2] bg-[#FAFAFB] px-4 py-3.5">
            <p
              className="text-[10.5px] tracking-[0.12em] text-[#9498A0] uppercase"
              style={{ fontFamily: FONT_MONO }}
            >
              Storefront URL
            </p>
            <p
              className="mt-1.5 truncate text-[13px] text-[#0B0C0E]"
              style={{ fontFamily: FONT_MONO }}
            >
              <span className="text-[#9498A0]">
                {preview.pathPrefix ?? '/'}
              </span>
              {slug ? (
                <span className="text-[#2B6CF6]">{slug}</span>
              ) : (
                <span className="cp-caret text-[#C2C5CC]">▍</span>
              )}
            </p>
          </div>
        )}

        <dl className="divide-y divide-[#F1F2F5]">
          {summaryNames.map((name) => {
            const field = fields.find((item) => item.name === name);
            if (!field) return null;
            const value = displayValue(field);

            return (
              <div
                key={name}
                className="flex items-baseline justify-between gap-4 px-4 py-2.5"
              >
                <dt className="shrink-0 text-[12.5px] text-[#6E7278]">
                  {field.label}
                </dt>
                <dd
                  className={`truncate text-right text-[12.5px] ${
                    value ? 'text-[#0B0C0E]' : 'text-[#C2C5CC]'
                  }`}
                >
                  {value || '—'}
                </dd>
              </div>
            );
          })}
        </dl>
      </div>

      <p className="mt-3 px-1 text-[12px] leading-relaxed text-[#8A8E96]">
        Nothing is written until you create the record.
      </p>
    </aside>
  );
}

/**
 * Precision create-page design.
 *
 * @param {Object} props
 * @param {CreatePageSpec} props.spec
 * @param {boolean} props.isSaving
 * @returns {React.ReactElement}
 */
export default function PrecisionCreatePage({ spec, isSaving }) {
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
      className="relative overflow-hidden rounded-xl border border-[#E6E7EB] bg-[#FAFAFB] text-[#0B0C0E]"
      style={{ fontFamily: FONT_BODY }}
    >
      {/* Sheen: a single cool wash so the header separates from the cards. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[linear-gradient(180deg,rgba(43,108,246,0.05),transparent)]"
      />

      <Form method="post" className="relative">
        <header className="border-b border-[#E6E7EB] px-5 py-6 sm:px-8 sm:py-7">
          <Reveal delay={0} from="translate-y-2">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <nav aria-label="Breadcrumb">
                  <ol
                    className="flex flex-wrap items-center gap-1.5 text-[12px] text-[#6E7278]"
                    style={{ fontFamily: FONT_MONO }}
                  >
                    {spec.breadcrumbs.map((crumb, index) => (
                      <li
                        key={crumb.label}
                        className="flex items-center gap-1.5"
                      >
                        {index > 0 && (
                          <span aria-hidden="true" className="text-[#C2C5CC]">
                            /
                          </span>
                        )}
                        {crumb.href ? (
                          <Link
                            to={crumb.href}
                            className="transition-colors hover:text-[#0B0C0E]"
                          >
                            {crumb.label}
                          </Link>
                        ) : (
                          <span className="text-[#0B0C0E]">{crumb.label}</span>
                        )}
                      </li>
                    ))}
                  </ol>
                </nav>

                <h1 className="mt-2.5 text-[26px] leading-tight font-semibold tracking-[-0.025em]">
                  {spec.title}
                </h1>
                {spec.subtitle && (
                  <p className="mt-1.5 max-w-xl text-[14px] leading-relaxed text-[#6E7278]">
                    {spec.subtitle}
                  </p>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-2.5">
                <Link
                  to={spec.cancelHref}
                  className="rounded-lg border border-[#E0E1E6] bg-white px-3.5 py-2 text-[13px] font-medium text-[#3C4048] shadow-[0_1px_2px_rgba(11,12,14,0.05)] transition-colors hover:bg-[#F5F6F8]"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center gap-2.5 rounded-lg bg-[#0B0C0E] px-4 py-2 text-[13px] font-medium text-white shadow-[0_1px_2px_rgba(11,12,14,0.18)] transition hover:bg-[#22252B] disabled:opacity-50"
                >
                  {isSaving
                    ? (spec.submittingLabel ?? 'Saving…')
                    : spec.submitLabel}
                  <kbd
                    className="rounded border border-white/20 px-1.5 py-px text-[10px] text-white/70"
                    style={{ fontFamily: FONT_MONO }}
                  >
                    ⌘↵
                  </kbd>
                </button>
              </div>
            </div>
          </Reveal>
        </header>

        <div className="px-5 py-7 sm:px-8">
          {spec.error && (
            <div
              role="alert"
              className="mb-6 flex items-start gap-2.5 rounded-lg border border-[#F2C4C0] bg-[#FEF3F2] px-4 py-3"
            >
              <span
                aria-hidden="true"
                className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#D0463B]"
              />
              <p className="text-[13.5px] text-[#9B2C22]">{spec.error}</p>
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="space-y-5">
              {spec.sections.map((section, index) => (
                <Reveal
                  key={section.id}
                  delay={90 + index * 80}
                  from="translate-y-2"
                  className="rounded-xl border border-[#E6E7EB] bg-white p-5 shadow-[0_1px_2px_rgba(11,12,14,0.04)] sm:p-6"
                >
                  <div className="mb-5">
                    <p
                      className="text-[10.5px] tracking-[0.12em] text-[#9498A0] uppercase"
                      style={{ fontFamily: FONT_MONO }}
                    >
                      {String(index + 1).padStart(2, '0')} · Section
                    </p>
                    <h2 className="mt-1.5 text-[15px] font-semibold tracking-[-0.01em]">
                      {section.title}
                    </h2>
                    {section.description && (
                      <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-[#6E7278]">
                        {section.description}
                      </p>
                    )}
                  </div>

                  <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
                    {section.fields.map((field) => (
                      <PrecisionField
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

            <Reveal delay={140} from="translate-y-2">
              <PreviewRail spec={spec} values={values} />
            </Reveal>
          </div>
        </div>
      </Form>
    </div>
  );
}
