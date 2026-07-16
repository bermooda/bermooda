// Shared settings form helpers for admin settings tabs.

import { CheckIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';

import Card from '#/components/admin/card';
import { controlClasses } from '#/components/admin/form/input';
import Button from '#/components/ui/button';

export const CHECKBOX_CLASS =
  'border-border text-accent focus:ring-accent bg-surface h-4 w-4 rounded';
export const RADIO_CLASS =
  'border-border text-accent focus:ring-accent h-4 w-4';

/**
 * @param {string} [extra]
 * @returns {string}
 */
export function inputClass(extra) {
  return clsx(controlClasses, extra);
}

/**
 * @returns {string}
 */
export function selectClass() {
  return clsx(controlClasses, 'pr-8');
}

/**
 * @param {Object} props
 * @param {{ state: string, data?: { ok?: boolean, intent?: string, error?: string } }} props.fetcher
 * @param {string} props.intent
 * @param {string} [props.label='Save']
 * @returns {React.ReactElement}
 */
export function SaveButton({ fetcher, intent, label = 'Save' }) {
  const busy = fetcher.state !== 'idle';
  const saved =
    fetcher.state === 'idle' &&
    fetcher.data?.ok &&
    fetcher.data?.intent === intent;
  return (
    <div className="flex items-center gap-3">
      <Button type="submit" disabled={busy}>
        {busy ? 'Saving…' : label}
      </Button>
      {saved && (
        <span className="text-success flex items-center gap-1 text-sm">
          <CheckIcon className="h-4 w-4" />
          Saved
        </span>
      )}
      {fetcher.state === 'idle' &&
        fetcher.data &&
        !fetcher.data.ok &&
        fetcher.data?.intent === intent && (
          <span className="text-danger text-sm">
            {fetcher.data.error ?? 'Error saving.'}
          </span>
        )}
    </div>
  );
}

/**
 * @param {Object} props
 * @param {string} props.title
 * @param {React.ReactNode} props.children
 * @returns {React.ReactElement}
 */
export function SectionCard({ title, children }) {
  return (
    <Card padded={false}>
      <div className="border-border border-b px-4 py-4 sm:px-6">
        <h2 className="text-text text-base font-semibold">{title}</h2>
      </div>
      <div className="p-4 sm:p-6">{children}</div>
    </Card>
  );
}

/**
 * @param {Object} props
 * @param {React.ReactNode} props.children
 * @returns {React.ReactElement}
 */
export function FieldLabel({ children }) {
  return (
    <label className="text-text mb-1 block text-sm font-medium">
      {children}
    </label>
  );
}
