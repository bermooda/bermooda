import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { Form } from 'react-router';

import { useT } from '#/core/i18n/index';

const COUNTRIES = ['US', 'GB', 'DE', 'FR', 'AU', 'CA'];

function AddressForm({ initial = {}, onCancel }) {
  const t = useT();
  return (
    <Form
      method="post"
      className="space-y-4 rounded-xl border border-zinc-200 p-6 dark:border-zinc-700"
    >
      <input type="hidden" name="intent" value={initial.id ? 'edit' : 'add'} />
      {initial.id && (
        <input type="hidden" name="addressId" value={initial.id} />
      )}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {t('address.firstName')}
          </label>
          <input
            name="firstName"
            defaultValue={initial.firstName ?? ''}
            required
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {t('address.lastName')}
          </label>
          <input
            name="lastName"
            defaultValue={initial.lastName ?? ''}
            required
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800"
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {t('address.line1')}
        </label>
        <input
          name="line1"
          defaultValue={initial.line1 ?? ''}
          required
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {t('address.line2')}
        </label>
        <input
          name="line2"
          defaultValue={initial.line2 ?? ''}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800"
        />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {t('address.city')}
          </label>
          <input
            name="city"
            defaultValue={initial.city ?? ''}
            required
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {t('address.state')}
          </label>
          <input
            name="state"
            defaultValue={initial.state ?? ''}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {t('address.postalCode')}
          </label>
          <input
            name="postalCode"
            defaultValue={initial.postalCode ?? ''}
            required
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800"
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {t('address.country')}
        </label>
        <select
          name="country"
          defaultValue={initial.country ?? 'US'}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800"
        >
          {COUNTRIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-3">
        <button
          type="submit"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900"
        >
          {t('common.save')}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-600"
          >
            {t('common.cancel')}
          </button>
        )}
      </div>
    </Form>
  );
}

export default function AccountAddressesPage({ addresses = [] }) {
  const t = useT();
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          {t('account.addresses')}
        </h1>
        <button
          onClick={() => {
            setShowAdd(true);
            setEditId(null);
          }}
          className="flex items-center gap-1 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900"
        >
          <PlusIcon className="h-4 w-4" />
          {t('address.add')}
        </button>
      </div>

      {showAdd && <AddressForm onCancel={() => setShowAdd(false)} />}

      {addresses.length === 0 && !showAdd ? (
        <div className="rounded-xl border border-dashed border-zinc-300 px-6 py-10 text-center dark:border-zinc-600">
          <p className="text-sm text-zinc-500">No addresses saved yet.</p>
        </div>
      ) : (
        <ul className="space-y-4">
          {addresses.map((addr) => (
            <li
              key={addr.id}
              className="rounded-xl border border-zinc-200 px-6 py-4 dark:border-zinc-700"
            >
              {editId === addr.id ? (
                <AddressForm initial={addr} onCancel={() => setEditId(null)} />
              ) : (
                <div className="flex items-start justify-between gap-4">
                  <address className="text-sm text-zinc-700 not-italic dark:text-zinc-300">
                    {addr.isDefault && (
                      <span className="mb-1 inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                        {t('address.default')}
                      </span>
                    )}
                    <p className="font-medium">
                      {addr.firstName} {addr.lastName}
                    </p>
                    <p>{addr.line1}</p>
                    {addr.line2 && <p>{addr.line2}</p>}
                    <p>
                      {addr.city}, {addr.state} {addr.postalCode}
                    </p>
                    <p>{addr.country}</p>
                  </address>
                  <div className="flex shrink-0 gap-2">
                    {!addr.isDefault && (
                      <Form method="post">
                        <input type="hidden" name="intent" value="setDefault" />
                        <input type="hidden" name="addressId" value={addr.id} />
                        <button
                          type="submit"
                          className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                        >
                          {t('address.setDefault')}
                        </button>
                      </Form>
                    )}
                    <button
                      onClick={() => setEditId(addr.id)}
                      className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                    <Form method="post">
                      <input type="hidden" name="intent" value="delete" />
                      <input type="hidden" name="addressId" value={addr.id} />
                      <button
                        type="submit"
                        className="text-zinc-500 hover:text-red-600"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </Form>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
