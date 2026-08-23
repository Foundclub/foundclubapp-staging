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
// « (0, _imageUrl.default) is not a function ».
//
// Mesure du 2026-08-23, APRES le passage des ecrans de compo au helper
// `getCompositionPlayerAvatarUrl` (le « 21 fichiers » de D49 etait perime, et
// il melangeait deux comptes differents — les voici separes) :
//   · 40 fichiers MENTIONNENT ce module ;
//   · 23 l'IMPORTENT vraiment — 21 en NOMME et 2 en DEFAUT ;
//   · 15 le DOUBLENT seulement (`jest.mock`), 2 le citent en commentaire.
// Les 2 en DEFAUT sont `views/PollDetails.web.js` et
// `views/event/EventDetails.web.js` : ce sont ces deux ecrans-la que le mur
// bloquait, pas les 38 autres. L'export nomme reste : les 21 l'importent ainsi.
//
// ⚠️ Ce commentaire cite la chaine cherchee : sans le `grep -v`, la mesure se
// compte elle-meme. Se remesure par, depuis la racine de `app` :
//   grep -rl "utils/imageUrl" src --include="*.js" \
//     | grep -v "^src/utils/imageUrl" | wc -l      # 40 mentions
//   grep -rln "from .*utils/imageUrl" src --include="*.js" \
//     | grep -v "^src/utils/imageUrl" | wc -l      # 23 imports
export default getImageUrl;
