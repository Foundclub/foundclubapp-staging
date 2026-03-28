const DOCUMENT_FALLBACK_PREFIXES = [
  'piece jointe',
];

const IMAGE_EXTENSION_REGEX = /\.(png|jpe?g|gif|webp|bmp|heic|heif|svg)$/i;
const AUDIO_EXTENSION_REGEX = /\.(mp4|m4a|aac|mp3|wav|ogg|oga|webm)$/i;

const normalizeString = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '');

const getAttachmentName = (attachment) => String(
  attachment?.name
  || attachment?.fileName
  || attachment?.alternativeText
  || attachment?.caption
  || '',
).trim();

const getReadableAttachmentName = (attachment) => {
  const rawName = getAttachmentName(attachment);
  if (!rawName) return '';

  try {
    return decodeURIComponent(rawName.replace(/\+/g, '%20'));
  } catch (_error) {
    return rawName;
  }
};

const getAttachmentUrlLike = (attachment) => String(
  attachment?.url
  || attachment?.uri
  || attachment?.previewUrl
  || '',
).trim();

export const getAttachmentExtension = (attachment) => {
  const source = getAttachmentName(attachment) || getAttachmentUrlLike(attachment);
  const cleanSource = source.split('?')[0].split('#')[0];
  const lastDotIndex = cleanSource.lastIndexOf('.');
  if (lastDotIndex < 0) return '';
  return cleanSource.slice(lastDotIndex + 1).trim().toLowerCase();
};

export const getDocumentBadgeLabel = (attachment) => {
  const extension = getAttachmentExtension(attachment);
  const mime = String(attachment?.mime || '').trim().toLowerCase();

  if (mime.includes('pdf') || extension === 'pdf') return 'PDF';
  if (mime.includes('word') || ['doc', 'docx', 'odt', 'rtf'].includes(extension)) return 'DOC';
  if (
    mime.includes('sheet')
    || mime.includes('excel')
    || mime.includes('csv')
    || ['csv', 'ods', 'xls', 'xlsx'].includes(extension)
  ) {
    return 'XLS';
  }
  if (
    mime.includes('zip')
    || mime.includes('compressed')
    || ['7z', 'gz', 'rar', 'tar', 'zip'].includes(extension)
  ) {
    return 'ZIP';
  }
  if (extension) return extension.slice(0, 4).toUpperCase();
  return 'FICHIER';
};

export const getDocumentKind = (attachment) => {
  const badgeLabel = getDocumentBadgeLabel(attachment);
  if (badgeLabel === 'PDF') return 'pdf';
  if (badgeLabel === 'DOC') return 'doc';
  if (badgeLabel === 'XLS') return 'xls';
  if (badgeLabel === 'ZIP') return 'zip';
  return 'file';
};

export const isImageAttachment = (attachment) => {
  const mime = String(attachment?.mime || '').toLowerCase();
  const source = [
    getAttachmentName(attachment),
    getAttachmentUrlLike(attachment),
    attachment?.ext || '',
  ].join(' ');
  return mime.startsWith('image/') || IMAGE_EXTENSION_REGEX.test(source);
};

export const isAudioAttachment = (attachment) => {
  const mime = String(attachment?.mime || '').toLowerCase();
  const source = `${getAttachmentName(attachment)} ${getAttachmentUrlLike(attachment)}`;
  return mime.startsWith('audio/') || AUDIO_EXTENSION_REGEX.test(source);
};

export const isDocumentAttachment = (attachment) => (
  Boolean(attachment)
  && !isImageAttachment(attachment)
  && !isAudioAttachment(attachment)
);

export const getPrimaryDocumentAttachment = (attachments = []) => (
  Array.isArray(attachments)
    ? attachments.find((attachment) => isDocumentAttachment(attachment)) || null
    : null
);

export const formatAttachmentSize = (value) => {
  const sizeInBytes = Number(value);
  if (!Number.isFinite(sizeInBytes) || sizeInBytes <= 0) return '';
  if (sizeInBytes < 1024) return `${Math.round(sizeInBytes)} B`;
  if (sizeInBytes < 1024 * 1024) return `${Math.round(sizeInBytes / 1024)} KB`;
  return `${(sizeInBytes / (1024 * 1024)).toFixed(sizeInBytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
};

export const getDocumentDisplayName = (attachment) => {
  const rawName = getReadableAttachmentName(attachment);
  if (!rawName) return 'Fichier';

  if (rawName.length <= 38) return rawName;

  const extension = getAttachmentExtension(attachment);
  if (!extension) return `${rawName.slice(0, 35)}...`;

  const extensionWithDot = `.${extension}`;
  const availableLength = Math.max(12, 38 - extensionWithDot.length - 3);
  const baseName = rawName.slice(0, rawName.length - extensionWithDot.length);
  return `${baseName.slice(0, availableLength)}...${extensionWithDot}`;
};

export const getDocumentPreviewText = (attachments = []) => {
  const documentAttachments = Array.isArray(attachments)
    ? attachments.filter((attachment) => isDocumentAttachment(attachment))
    : [];

  if (documentAttachments.length === 0) return '';
  if (documentAttachments.length > 1) {
    return `${documentAttachments.length} fichiers`;
  }

  const attachment = documentAttachments[0];
  const badgeLabel = getDocumentBadgeLabel(attachment);
  const fileName = getReadableAttachmentName(attachment) || 'fichier';
  return `${badgeLabel} • ${fileName}`;
};

export const isGeneratedDocumentFallbackText = (messageText, attachments = []) => {
  const normalizedText = normalizeString(messageText);
  if (!normalizedText) return false;

  const hasKnownPrefix = DOCUMENT_FALLBACK_PREFIXES
    .some((prefix) => normalizedText.startsWith(prefix));
  if (!hasKnownPrefix) return false;

  const primaryAttachment = getPrimaryDocumentAttachment(attachments);
  if (!primaryAttachment) return true;

  const attachmentName = normalizeString(getAttachmentName(primaryAttachment));
  if (!attachmentName) return true;

  return normalizedText.includes(attachmentName);
};

export const getDocumentCaption = (messageText, attachments = []) => {
  const normalizedText = String(messageText || '').trim();
  if (!normalizedText) return '';
  if (isGeneratedDocumentFallbackText(normalizedText, attachments)) return '';
  return normalizedText;
};
