import { PhotoIcon, TrashIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';
import { useFetcher, useRevalidator } from 'react-router';

import { useT } from '#/core/i18n';
import {
  CHECKBOX_CLASS,
  FieldLabel,
  SaveButton,
  SectionCard,
  inputClass,
} from '#/components/admin/settings/shared';

/**
 * SEO image uploader for settings.
 *
 * @param {Object} props
 * @param {string} [props.imageUrl]
 * @returns {React.ReactElement}
 */
export function SeoImageUploader({ imageUrl }) {
  const t = useT();
  const fetcher = useFetcher();
  const { revalidate } = useRevalidator();
  const fileRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState(imageUrl);

  useEffect(() => {
    setPreviewUrl(imageUrl);
  }, [imageUrl]);

  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data?.ok) {
      if (
        fetcher.data.intent === 'upload-seo-image' &&
        fetcher.data.ogImageUrl
      ) {
        setPreviewUrl(fetcher.data.ogImageUrl);
      }
      if (fetcher.data.intent === 'remove-seo-image') {
        setPreviewUrl('');
      }
      revalidate();
    }
  }, [fetcher.state, fetcher.data, revalidate]);

  function handleFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('intent', 'upload-seo-image');
    fd.append('file', file);
    fetcher.submit(fd, { method: 'post', encType: 'multipart/form-data' });
    if (fileRef.current) fileRef.current.value = '';
  }

  function handleRemove() {
    const fd = new FormData();
    fd.append('intent', 'remove-seo-image');
    fetcher.submit(fd, { method: 'post' });
  }

  const isUploading =
    fetcher.state !== 'idle' &&
    fetcher.formData?.get('intent') === 'upload-seo-image';
  const isRemoving =
    fetcher.state !== 'idle' &&
    fetcher.formData?.get('intent') === 'remove-seo-image';

  return (
    <div>
      <FieldLabel>{t('admin.settings.seo.imageLabel')}</FieldLabel>
      <p className="text-text-muted mb-3 text-xs">
        {t('admin.settings.seo.imageHelp')}
      </p>

      {previewUrl ? (
        <div className="border-border bg-surface-2 relative max-w-md overflow-hidden rounded-lg border">
          <img
            src={previewUrl}
            alt={t('admin.settings.seo.imageAlt')}
            className="aspect-[1200/630] w-full object-cover"
          />
          <button
            type="button"
            onClick={handleRemove}
            disabled={isRemoving}
            className="bg-surface/90 text-text hover:text-danger absolute top-2 right-2 rounded-md p-1.5 shadow-sm transition disabled:opacity-50"
            aria-label={t('admin.settings.seo.removeImage')}
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <label
          className={clsx(
            'border-border text-text-muted hover:border-accent hover:bg-accent/5 hover:text-accent flex max-w-md cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 transition-colors',
            isUploading && 'cursor-wait opacity-60'
          )}
        >
          {isUploading ? (
            <span className="text-sm">{t('admin.settings.seo.uploading')}</span>
          ) : (
            <>
              <PhotoIcon className="h-8 w-8" />
              <span className="mt-2 text-sm font-medium">
                {t('admin.settings.seo.uploadImage')}
              </span>
            </>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={handleFileChange}
            disabled={isUploading}
          />
        </label>
      )}

      {previewUrl && (
        <div className="mt-3">
          <label
            className={clsx(
              'text-accent inline-flex cursor-pointer items-center gap-1 text-sm hover:underline',
              isUploading && 'cursor-wait opacity-60'
            )}
          >
            {isUploading
              ? t('admin.settings.seo.uploading')
              : t('admin.settings.seo.replaceImage')}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handleFileChange}
              disabled={isUploading}
            />
          </label>
        </div>
      )}
    </div>
  );
}

/**
 * SEO settings tab.
 *
 * @param {Object} props
 * @param {object} props.data
 * @returns {React.ReactElement}
 */
export function SeoTab({ data }) {
  const t = useT();
  const fetcher = useFetcher();

  return (
    <SectionCard title={t('admin.settings.seo.title')}>
      <fetcher.Form method="post" className="max-w-lg space-y-6">
        <input type="hidden" name="intent" value="save-seo" />

        <p className="text-text-muted text-sm">
          {t('admin.settings.seo.help')}
        </p>

        <div>
          <FieldLabel>{t('admin.settings.seo.metaTitle')}</FieldLabel>
          <input
            type="text"
            name="metaTitle"
            defaultValue={data.seoMetaTitle}
            placeholder={
              data.shopName || t('admin.settings.seo.metaTitlePlaceholder')
            }
            className={inputClass()}
          />
          <p className="text-text-muted mt-1 text-xs">
            {t('admin.settings.seo.metaTitleHelp')}
          </p>
        </div>

        <div>
          <FieldLabel>{t('admin.settings.seo.metaDescription')}</FieldLabel>
          <textarea
            name="metaDescription"
            defaultValue={data.seoMetaDescription}
            rows={3}
            placeholder={t('admin.settings.seo.metaDescriptionPlaceholder')}
            className={inputClass('resize-y')}
          />
          <p className="text-text-muted mt-1 text-xs">
            {t('admin.settings.seo.metaDescriptionHelp')}
          </p>
        </div>

        <div>
          <FieldLabel>{t('admin.settings.seo.titleTemplate')}</FieldLabel>
          <input
            type="text"
            name="titleTemplate"
            defaultValue={data.seoTitleTemplate}
            placeholder={t('admin.settings.seo.titleTemplatePlaceholder')}
            className={inputClass()}
          />
          <p className="text-text-muted mt-1 text-xs">
            {t('admin.settings.seo.titleTemplateHelp')}
          </p>
        </div>

        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            name="allowIndexing"
            defaultChecked={data.seoAllowIndexing}
            className={clsx(CHECKBOX_CLASS, 'mt-0.5')}
          />
          <span>
            <span className="text-text block text-sm font-medium">
              {t('admin.settings.seo.allowIndexing')}
            </span>
            <span className="text-text-muted mt-0.5 block text-xs">
              {t('admin.settings.seo.allowIndexingHelp')}
            </span>
          </span>
        </label>

        <div className="border-border border-t pt-6">
          <h3 className="text-text mb-4 text-sm font-semibold">
            {t('admin.settings.seo.verificationHeading')}
          </h3>
          <div className="space-y-4">
            <div>
              <FieldLabel>{t('admin.settings.seo.google')}</FieldLabel>
              <input
                type="text"
                name="googleSiteVerification"
                defaultValue={data.seoGoogleSiteVerification}
                placeholder={t('admin.settings.seo.verificationPlaceholder')}
                className={inputClass()}
              />
              <p className="text-text-muted mt-1 text-xs">
                {t('admin.settings.seo.googleHelp')}
              </p>
            </div>
            <div>
              <FieldLabel>{t('admin.settings.seo.bing')}</FieldLabel>
              <input
                type="text"
                name="bingSiteVerification"
                defaultValue={data.seoBingSiteVerification}
                placeholder={t('admin.settings.seo.verificationPlaceholder')}
                className={inputClass()}
              />
            </div>
          </div>
        </div>

        <div>
          <FieldLabel>{t('admin.settings.seo.twitter')}</FieldLabel>
          <input
            type="text"
            name="twitterHandle"
            defaultValue={data.seoTwitterHandle}
            placeholder={t('admin.settings.seo.twitterPlaceholder')}
            className={inputClass()}
          />
          <p className="text-text-muted mt-1 text-xs">
            {t('admin.settings.seo.twitterHelp')}
          </p>
        </div>

        <SaveButton fetcher={fetcher} intent="save-seo" />
      </fetcher.Form>

      <div className="border-border mt-8 max-w-lg border-t pt-8">
        <SeoImageUploader imageUrl={data.seoOgImageUrl} />
      </div>
    </SectionCard>
  );
}
