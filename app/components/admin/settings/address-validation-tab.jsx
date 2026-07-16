import clsx from 'clsx';
import { useState } from 'react';
import { useFetcher } from 'react-router';

import { controlClasses } from '#/components/admin/form/input';
import {
  FieldLabel,
  SaveButton,
  SectionCard,
} from '#/components/admin/settings/shared';

/**
 * Address validation settings tab.
 *
 * @param {Object} props
 * @param {object} props.data
 * @returns {React.ReactElement}
 */
export function AddressValidationTab({ data }) {
  const fetcher = useFetcher();
  const [provider, setProvider] = useState(data.addressValidationProvider);

  return (
    <SectionCard title="Address Validation">
      <fetcher.Form method="post" className="space-y-6">
        <input type="hidden" name="intent" value="save-address-validation" />
        <input type="hidden" name="provider" value={provider} />

        <p className="text-text-muted text-sm">
          Choose the provider used to validate shipping addresses during
          checkout. The built-in no-op provider accepts all addresses.
        </p>

        <div>
          <FieldLabel>Provider</FieldLabel>
          <select
            value={provider}
            onChange={(event) => setProvider(event.target.value)}
            className={clsx(controlClasses, 'mt-1 max-w-md')}
          >
            {data.addressValidationProviders.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </select>
        </div>

        <SaveButton fetcher={fetcher} intent="save-address-validation" />
      </fetcher.Form>
    </SectionCard>
  );
}
