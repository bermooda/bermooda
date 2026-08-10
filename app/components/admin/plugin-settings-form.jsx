import { Form, Link, useActionData } from 'react-router';

import { useT } from '#/core/i18n';
import FormSection from '#/components/admin/form-section';
import Field from '#/components/admin/form/field';
import Input from '#/components/admin/form/input';
import Select from '#/components/admin/form/select';
import { ErrorAlert, SuccessAlert } from '#/components/ui/alert';
import { ButtonSubmit } from '#/components/ui/button';

/**
 * @typedef {{
 *   key: string,
 *   label?: string,
 *   type: 'text' | 'select' | 'toggle' | 'password',
 *   default?: unknown,
 *   options?: Array<string | { value: string, label: string }>,
 * }} PluginSettingField
 */

/**
 * Renders a single setting field based on its type.
 *
 * @param {Object} props
 * @param {PluginSettingField} props.setting
 * @param {unknown} props.value
 * @returns {React.ReactElement | null}
 */
function SettingField({ setting, value }) {
  const t = useT();
  const { key, label, type, options } = setting;
  const id = `setting-${key}`;

  if (type === 'text') {
    return (
      <Field label={label ?? key} htmlFor={id}>
        <Input id={id} type="text" name={key} defaultValue={value ?? ''} />
      </Field>
    );
  }

  if (type === 'password') {
    const configured = value === '••••••••';
    return (
      <Field label={label ?? key} htmlFor={id}>
        <Input
          id={id}
          type="password"
          name={key}
          defaultValue=""
          autoComplete="off"
          placeholder={
            configured
              ? t('admin.plugins.detail.passwordKeepPlaceholder')
              : undefined
          }
        />
      </Field>
    );
  }

  if (type === 'select') {
    return (
      <Field label={label ?? key} htmlFor={id}>
        <Select id={id} name={key} defaultValue={value ?? ''}>
          {(options ?? []).map((opt) => {
            const optValue = typeof opt === 'object' ? opt.value : opt;
            const optLabel = typeof opt === 'object' ? opt.label : opt;
            return (
              <option key={optValue} value={optValue}>
                {optLabel}
              </option>
            );
          })}
        </Select>
      </Field>
    );
  }

  if (type === 'toggle') {
    return (
      <label className="flex cursor-pointer items-center gap-3">
        <div className="relative">
          <input
            id={id}
            type="checkbox"
            name={key}
            defaultChecked={value === true || value === 'true'}
            className="peer sr-only"
          />
          <div className="bg-surface-2 peer-checked:bg-accent h-5 w-9 rounded-full" />
          <div className="bg-bg absolute top-0.5 left-0.5 h-4 w-4 rounded-full transition peer-checked:translate-x-4" />
        </div>
        <span className="text-text text-sm font-medium">{label ?? key}</span>
      </label>
    );
  }

  return null;
}

/**
 * Manifest-driven settings form for a plugin (product-editor layout).
 *
 * @param {Object} props
 * @param {{ id: string, settings?: PluginSettingField[] }} props.manifest
 * @param {Record<string, unknown>} props.values
 * @returns {React.ReactElement | null}
 */
export default function PluginSettingsForm({ manifest, values }) {
  const t = useT();
  const actionData = useActionData();

  if (!manifest.settings?.length) return null;

  const saved = actionData?.savedSettings === manifest.id;

  return (
    <>
      {saved ? (
        <SuccessAlert message={t('admin.plugins.detail.settingsSaved')} />
      ) : null}
      {actionData?.error && !saved ? (
        <ErrorAlert message={actionData.error} />
      ) : null}

      <Form method="post" id="plugin-settings-form">
        <input type="hidden" name="intent" value="save-settings" />
        <input type="hidden" name="pluginId" value={manifest.id} />

        <div className="space-y-12">
          <FormSection
            title={t('admin.plugins.detail.settingsTitle')}
            description={t('admin.plugins.detail.settingsDescription')}
            last
          >
            <div className="max-w-2xl space-y-4">
              {manifest.settings.map((setting) => (
                <SettingField
                  key={setting.key}
                  setting={setting}
                  value={values[setting.key] ?? setting.default ?? ''}
                />
              ))}
            </div>
          </FormSection>
        </div>
      </Form>

      <div className="mt-6 mb-6 flex items-center justify-between gap-x-6">
        <span />
        <div className="flex items-center gap-x-6">
          <Link
            to="/admin/plugins"
            className="text-text text-sm/6 font-semibold transition-colors hover:opacity-80"
          >
            {t('admin.plugins.detail.cancel')}
          </Link>
          <ButtonSubmit form="plugin-settings-form">
            {t('admin.plugins.detail.saveSettings')}
          </ButtonSubmit>
        </div>
      </div>
    </>
  );
}
