import { getPublicApiOrigin } from '@/config/runtimeUrls';

/**
 * Transform image URL from Strapi to work with Android emulator
 * @param {string | undefined} url - The image URL from Strapi
 * @returns {string | undefined} - The transformed URL
 */
export const getImageUrl = (url) => {
  if (!url) return undefined;

  // If it's already a full URL with http/https, transform localhost to 10.0.2.2
  if (url.startsWith('http://localhost')) {
    return url.replace('http://localhost', 'http://10.0.2.2');
  }

  if (url.startsWith('https://localhost')) {
    return url.replace('https://localhost', 'http://10.0.2.2');
  }

  // If it's a relative URL, prepend the API base URL
  if (url.startsWith('/')) {
    return `${getPublicApiOrigin()}${url}`;
  }

  // Otherwise return as is
  return url;
};
