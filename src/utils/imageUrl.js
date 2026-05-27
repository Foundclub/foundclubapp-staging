import { getPublicApiOrigin } from '@/config/runtimeUrls';

/**
 * Transform image URL from Strapi to work with Android emulator
 * @param {string | undefined} url - The image URL from Strapi
 * @returns {string | undefined} - The transformed URL
 */
export const getImageUrl = (url) => {
  if (!url) return undefined;

  const publicOrigin = getPublicApiOrigin();
  const preferredLoopbackHost = (() => {
    try {
      return new URL(publicOrigin).hostname;
    } catch (_error) {
      return '';
    }
  })();

  // If it's already a full URL with http/https, align localhost with the current runtime host.
  if (url.startsWith('http://localhost')) {
    if (preferredLoopbackHost && preferredLoopbackHost !== 'localhost') {
      return url.replace('http://localhost', `http://${preferredLoopbackHost}`);
    }
    return url;
  }

  if (url.startsWith('https://localhost')) {
    if (preferredLoopbackHost) {
      return url.replace('https://localhost', `http://${preferredLoopbackHost}`);
    }
    return url.replace('https://localhost', 'http://localhost');
  }

  // If it's a relative URL, prepend the API base URL
  if (url.startsWith('/')) {
    return `${publicOrigin}${url}`;
  }

  // Otherwise return as is
  return url;
};
