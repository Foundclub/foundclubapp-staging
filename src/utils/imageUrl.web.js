/**
 * Transform image URL from Strapi for web runtime.
 * @param {string | undefined} url - The image URL from Strapi
 * @returns {string | undefined} - The transformed URL
 */
export const getImageUrl = (url) => {
  if (!url) return undefined;

  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  if (url.startsWith('/')) {
    const apiUrl = process.env.API_PUBLIC_URL || process.env.API_URL || 'http://localhost:1337/api';
    const baseUrl = String(apiUrl).replace(/\/api\/?$/i, '');
    return `${baseUrl}${url}`;
  }

  return url;
};

export default getImageUrl;
