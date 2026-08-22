import { getPublicApiOrigin } from '@/config/runtimeUrls';

/**
 * Transform image URL from Strapi to work with Android emulator
 * @param {string | undefined} url - The image URL from Strapi
 * @returns {string | undefined} - The transformed URL
 */
export const getImageUrl = (url) => {
  if (!url || typeof url !== 'string') return undefined;

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

// Porte de sortie identique a celle du jumeau `imageUrl.web.js` : les ecrans
// `.web.js` importent ce module en DEFAUT. Vite resout bien la variante web en
// production, mais Jest (preset react-native) prend ce fichier-ci, et sans cet
// export tout rendu d'un ecran `.web.js` mourait sur
// « (0, _imageUrl.default) is not a function ». Mesure D49 : 21 fichiers
// importent ce module, 19 en NOMME et 2 en DEFAUT — `views/PollDetails.web.js`
// et `views/event/EventDetails.web.js`. Ce sont ces deux ecrans-la que le mur
// bloquait, pas les 40. L'export nomme reste : les 19 autres l'importent ainsi.
export default getImageUrl;
