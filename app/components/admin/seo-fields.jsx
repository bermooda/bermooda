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
 * @param {string} [props.titleLabel='SEO title']
 * @param {string} [props.descriptionLabel='SEO description']
 * @param {string} [props.defaultTitle='']
 * @param {string} [props.defaultDescription='']
 */
export default function SeoFields({
  titleFieldName,
  descriptionFieldName,
  titleId,
  descriptionId,
  titleLabel = 'SEO title',
  descriptionLabel = 'SEO description',
  defaultTitle = '',
  defaultDescription = '',
}) {
  return (
    <div className="bg-surface-2/70 border-border rounded-lg border p-4">
      <p className="text-text-muted mb-4 text-xs font-semibold tracking-wide uppercase">
        SEO
      </p>
      <div className="space-y-4">
        <Field label={titleLabel} htmlFor={titleId}>
          <Input
            id={titleId}
            name={titleFieldName}
            type="text"
            defaultValue={defaultTitle}
          />
        </Field>
        <Field label={descriptionLabel} htmlFor={descriptionId}>
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
