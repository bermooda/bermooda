import { useT } from '#/core/i18n';
import Field from '#/components/admin/form/field';
import Input from '#/components/admin/form/input';
import Textarea from '#/components/admin/form/textarea';

/**
 * SEO title and description fields inside a bordered panel.
 *
 * @param {Object} props
 * @param {string} props.titleFieldName
 * @param {string} props.descriptionFieldName
 * @param {string} props.titleId
 * @param {string} props.descriptionId
 * @param {string} [props.titleLabel]
 * @param {string} [props.descriptionLabel]
 * @param {string} [props.defaultTitle='']
 * @param {string} [props.defaultDescription='']
 * @returns {React.ReactElement}
 */
export default function SeoFields({
  titleFieldName,
  descriptionFieldName,
  titleId,
  descriptionId,
  titleLabel,
  descriptionLabel,
  defaultTitle = '',
  defaultDescription = '',
}) {
  const t = useT();
  const resolvedTitleLabel = titleLabel ?? t('admin.seoFields.titleLabel');
  const resolvedDescriptionLabel =
    descriptionLabel ?? t('admin.seoFields.descriptionLabel');

  return (
    <div className="bg-surface-2/70 border-border rounded-lg border p-4">
      <p className="text-text-muted mb-4 text-xs font-semibold tracking-wide uppercase">
        {t('admin.seoFields.heading')}
      </p>
      <div className="space-y-4">
        <Field label={resolvedTitleLabel} htmlFor={titleId}>
          <Input
            id={titleId}
            name={titleFieldName}
            type="text"
            defaultValue={defaultTitle}
          />
        </Field>
        <Field label={resolvedDescriptionLabel} htmlFor={descriptionId}>
          <Textarea
            id={descriptionId}
            name={descriptionFieldName}
            rows={2}
            defaultValue={defaultDescription}
          />
        </Field>
      </div>
    </div>
  );
}
