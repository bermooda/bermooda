import { useState } from 'react';
import { Form, Link } from 'react-router';

import FieldControl from '#/components/admin/create-page/control';
import { fieldDomId, initialValues } from '#/components/admin/create-page/spec';

/** @typedef {import('#/components/admin/create-page/spec').CreatePageSpec} CreatePageSpec */
/** @typedef {import('#/components/admin/create-page/spec').CreateFieldSpec} CreateFieldSpec */

/*
 * Guided — one question at a time.
 *
 * Structure: no form page at all. A single centred column asks for one field
 * per step at display size, with a progress rail above and Back/Continue
 * below. Every field stays mounted but hidden so the final Review step can
 * post the whole record in one go — submitting is only possible from there.
 */

const CONTROL =
  'block w-full rounded-none border-0 border-b-2 border-[var(--cpd-line-strong)] bg-transparent px-0 pb-3 text-[26px] text-[var(--cpd-text)] outline-none transition-colors placeholder:text-[var(--cpd-faint)] focus:border-[var(--cpd-accent)]';

/**
 * Human-readable value for the review list.
 *
 * @param {CreateFieldSpec} field
 * @param {Record<string, string>} values
 * @returns {string}
 */
function displayValue(field, values) {
  const raw = values[field.name] ?? '';
  if (!raw) return '';
  if (field.type === 'select') {
    return field.options?.find((option) => option.value === raw)?.label ?? raw;
  }
  return raw;
}

/**
 * Guided create-page design.
 *
 * @param {Object} props
 * @param {CreatePageSpec} props.spec
 * @param {boolean} props.isSaving
 * @returns {React.ReactElement}
 */
export default function GuidedCreatePage({ spec, isSaving }) {
  const steps = spec.sections.flatMap((section) =>
    section.fields.map((field) => ({ section, field }))
  );
  const reviewIndex = steps.length;
  const [step, setStep] = useState(spec.error ? reviewIndex : 0);
  const [values, setValues] = useState(() => initialValues(spec));

  const current = steps[step];
  const isReview = step === reviewIndex;
  const blocked =
    !isReview &&
    Boolean(current.field.required) &&
    !(values[current.field.name] ?? '').trim();

  /**
   * @param {string} name
   * @param {string} value
   */
  function handleValueChange(name, value) {
    setValues((previous) => ({ ...previous, [name]: value }));
  }

  /**
   * Enter advances the flow instead of submitting, since submitting is only
   * legal from the review step.
   *
   * @param {React.KeyboardEvent<HTMLFormElement>} event
   */
  function handleKeyDown(event) {
    if (event.key !== 'Enter' || isReview) return;
    if (event.target instanceof HTMLTextAreaElement) return;
    event.preventDefault();
    if (!blocked) setStep(step + 1);
  }

  return (
    <div
      className="cpd-guided rounded-2xl border border-[var(--cpd-line)] bg-[var(--cpd-bg)] text-[var(--cpd-text)]"
      style={{ fontFamily: 'var(--cpd-font-body)' }}
    >
      <Form
        method="post"
        onKeyDown={handleKeyDown}
        className="mx-auto flex min-h-[34rem] w-full max-w-2xl flex-col px-6 py-9 sm:px-8 sm:py-12"
      >
        {/* Progress rail */}
        <div className="flex items-center gap-3">
          <div className="flex flex-1 gap-1.5">
            {Array.from({ length: reviewIndex + 1 }, (_, index) => (
              <span
                key={index}
                aria-hidden="true"
                className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                  index <= step
                    ? 'bg-[var(--cpd-accent)]'
                    : 'bg-[var(--cpd-line)]'
                }`}
              />
            ))}
          </div>
          <p className="shrink-0 text-[11px] tracking-[0.14em] text-[var(--cpd-muted)] uppercase">
            {isReview ? 'Review' : `${step + 1} / ${reviewIndex}`}
          </p>
        </div>

        <nav aria-label="Breadcrumb" className="mt-6">
          <ol className="flex flex-wrap items-center gap-1.5 text-[12.5px] text-[var(--cpd-muted)]">
            {spec.breadcrumbs.map((crumb, index) => (
              <li key={crumb.label} className="flex items-center gap-1.5">
                {index > 0 && <span aria-hidden="true">›</span>}
                {crumb.href ? (
                  <Link
                    to={crumb.href}
                    className="transition-colors hover:text-[var(--cpd-accent)]"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-[var(--cpd-text)]">{crumb.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>

        {spec.error && (
          <div
            role="alert"
            className="mt-6 rounded-lg bg-[var(--cpd-danger-soft)] px-4 py-3"
          >
            <p className="text-[13.5px] font-medium text-[var(--cpd-danger)]">
              {spec.error}
            </p>
          </div>
        )}

        {/* Every control stays in the DOM so the final post carries them all. */}
        <div className="flex flex-1 flex-col justify-center py-10">
          {spec.sections.map((section) =>
            section.fields.map((field) => {
              const index = steps.findIndex(
                (entry) => entry.field.name === field.name
              );
              const active = index === step;

              return (
                <div key={field.name} hidden={!active}>
                  <p className="text-[11px] font-semibold tracking-[0.24em] text-[var(--cpd-accent)] uppercase">
                    {section.title}
                  </p>
                  <label
                    htmlFor={fieldDomId(section.id, field.name)}
                    className="mt-4 block text-[clamp(1.9rem,4.5vw,2.75rem)] leading-[1.08] tracking-[-0.02em]"
                    style={{ fontFamily: 'var(--cpd-font-display)' }}
                  >
                    {field.label}
                    {!field.required && (
                      <span className="ml-3 align-middle text-[13px] tracking-[0.14em] text-[var(--cpd-faint)] uppercase">
                        Optional
                      </span>
                    )}
                  </label>
                  {field.hint && (
                    <p className="mt-3 text-[15px] leading-relaxed text-[var(--cpd-muted)]">
                      {field.hint}
                    </p>
                  )}

                  <div className="mt-9">
                    <FieldControl
                      field={field}
                      sectionId={section.id}
                      required={false}
                      onValueChange={handleValueChange}
                      className={
                        field.type === 'select'
                          ? `${CONTROL} appearance-none`
                          : CONTROL
                      }
                    />
                  </div>
                </div>
              );
            })
          )}

          {isReview && (
            <div>
              <p className="text-[11px] font-semibold tracking-[0.24em] text-[var(--cpd-accent)] uppercase">
                Almost there
              </p>
              <h2
                className="mt-4 text-[clamp(1.9rem,4.5vw,2.75rem)] leading-[1.08] tracking-[-0.02em]"
                style={{ fontFamily: 'var(--cpd-font-display)' }}
              >
                {spec.title}
              </h2>
              {spec.subtitle && (
                <p className="mt-3 text-[15px] leading-relaxed text-[var(--cpd-muted)]">
                  {spec.subtitle}
                </p>
              )}

              <dl className="mt-8 divide-y divide-[var(--cpd-line)] border-y border-[var(--cpd-line)]">
                {steps.map((entry, index) => {
                  const value = displayValue(entry.field, values);

                  return (
                    <div
                      key={entry.field.name}
                      className="flex items-baseline gap-4 py-3.5"
                    >
                      <dt className="w-40 shrink-0 text-[13px] text-[var(--cpd-muted)]">
                        {entry.field.label}
                      </dt>
                      <dd
                        className={`min-w-0 flex-1 truncate text-[15px] ${
                          value
                            ? 'text-[var(--cpd-text)]'
                            : 'text-[var(--cpd-faint)]'
                        }`}
                      >
                        {value || 'Not set'}
                      </dd>
                      <button
                        type="button"
                        onClick={() => setStep(index)}
                        className="shrink-0 text-[12.5px] font-medium text-[var(--cpd-accent)] underline underline-offset-4"
                      >
                        Edit
                      </button>
                    </div>
                  );
                })}
              </dl>
            </div>
          )}
        </div>

        {/* Navigation — never more than one forward action. */}
        <div className="flex items-center justify-between gap-4 border-t border-[var(--cpd-line)] pt-6">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="rounded-full px-4 py-2.5 text-[14px] font-medium text-[var(--cpd-muted)] transition-colors hover:text-[var(--cpd-text)]"
            >
              ← Back
            </button>
          ) : (
            <Link
              to={spec.cancelHref}
              className="rounded-full px-4 py-2.5 text-[14px] font-medium text-[var(--cpd-muted)] transition-colors hover:text-[var(--cpd-text)]"
            >
              Cancel
            </Link>
          )}

          {/*
            Distinct keys are load-bearing: without them React reuses one DOM
            node for both buttons, so the click that advances to the review
            step lands on a node that has already become `type="submit"` and
            posts the form.
          */}
          {isReview ? (
            <button
              key="submit"
              type="submit"
              disabled={isSaving}
              className="rounded-full bg-[var(--cpd-accent)] px-8 py-3 text-[14px] font-semibold text-[var(--cpd-accent-fg)] transition hover:brightness-110 disabled:opacity-55"
            >
              {isSaving
                ? (spec.submittingLabel ?? 'Saving…')
                : spec.submitLabel}
            </button>
          ) : (
            <button
              key="continue"
              type="button"
              onClick={() => setStep(step + 1)}
              disabled={blocked}
              className="rounded-full bg-[var(--cpd-accent)] px-8 py-3 text-[14px] font-semibold text-[var(--cpd-accent-fg)] transition hover:brightness-110 disabled:opacity-40"
            >
              Continue →
            </button>
          )}
        </div>
      </Form>
    </div>
  );
}
