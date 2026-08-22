import { getPublicApiOrigin } from '@/config/runtimeUrls';

/**
 * Transform image URL from Strapi for web runtime.
 * @param {string | undefined} url - The image URL from Strapi
 * @returns {string | undefined} - The transformed URL
 */
export const getImageUrl = (url) => {
  if (!url || typeof url !== 'string') return undefined;

  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  if (url.startsWith('/')) {
    return `${getPublicApiOrigin()}${url}`;
  }

  return url;
};

export default getImageUrl;
