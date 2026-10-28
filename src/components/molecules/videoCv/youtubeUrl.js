/**
 * VIDEOCV (28/10, planche validée par Adel) — les règles du lien YouTube, côté app.
 * Les mêmes que le serveur (`admin/src/api/firebase-auth/services/youtube-url.ts`), qui reste seul
 * juge : ici, elles servent à afficher l'erreur sous le champ et à trouver l'ID de la vidéo.
 * Analyse à la main, sans `new URL()` : le `URL` de React Native ne sait pas lire `hostname`.
 */

export const YOUTUBE_ALLOWED_HOSTS = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'];
export const YOUTUBE_URL_MAX_LENGTH = 200;
export const YOUTUBE_PLAYER_ORIGIN = 'https://foundclub.app';

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const URL_PARTS = /^(https?):\/\/([^/?#]*)([^?#]*)(\?[^#]*)?(#.*)?$/i;

/**
 * @param {string} videoId
 * @returns {string}
 */
export const buildYoutubeCanonicalUrl = (videoId) => `https://www.youtube.com/watch?v=${videoId}`;

/**
 * @param {string} videoId
 * @returns {string}
 */
export const buildYoutubeThumbnailUrl = (videoId) => `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

/**
 * @param {string} path
 * @param {string} query
 * @param {string} host
 * @returns {string}
 */
const extractVideoId = (path, query, host) => {
  if (host === 'youtu.be') return path.replace(/^\/|\/$/g, '');
  if (path === '/watch' || path === '/watch/') {
    const pair = query.replace(/^\?/, '').split('&').find((part) => part.startsWith('v='));
    return pair ? pair.slice(2) : '';
  }
  const short = path.match(/^\/shorts\/([^/]*)\/?$/);
  return short ? short[1] : '';
};

/**
 * Lit un lien YouTube collé par le joueur.
 * @param {unknown} value
 * @returns {{ empty: true } | { error: 'host' | 'incomplete' } | { canonicalUrl: string, videoId: string }}
 */
export const parseYoutubeUrl = (value) => {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return { empty: true };
  if (raw.length > YOUTUBE_URL_MAX_LENGTH) return { error: 'host' };
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  const parts = withScheme.match(URL_PARTS);
  if (!parts) return { error: 'host' };
  const [, , authority, path, query = ''] = parts;
  // Un `@` (identifiant) ou un `:` (port) dans l'adresse : refusé, même devant youtube.com.
  if (/[@:]/.test(authority)) return { error: 'host' };
  const host = authority.toLowerCase();
  if (!YOUTUBE_ALLOWED_HOSTS.includes(host)) return { error: 'host' };
  const videoId = extractVideoId(path, query, host);
  if (!VIDEO_ID.test(videoId)) return { error: 'incomplete' };
  return { canonicalUrl: buildYoutubeCanonicalUrl(videoId), videoId };
};

/**
 * La page du lecteur du téléphone : l'API du lecteur YouTube, sur youtube-nocookie, chargée avec
 * l'origine FoundClub (sans elle, YouTube répond « erreur 153 » dans une WebView). Les erreurs du
 * lecteur remontent à l'app par `postMessage`.
 * @param {string} videoId
 * @returns {string}
 */
export const buildYoutubeEmbedPage = (videoId) => {
  if (!VIDEO_ID.test(videoId)) throw new Error('VIDEOCV : ID de vidéo hors forme');
  return `<!doctype html>
<html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<meta name="referrer" content="strict-origin-when-cross-origin">
<style>html,body{margin:0;height:100%;background:#000;overflow:hidden}#p{width:100%;height:100%}</style>
</head><body><div id="p"></div>
<script>
function envoyer(m){window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify(m));}
function onYouTubeIframeAPIReady(){
  new YT.Player('p', {
    host: 'https://www.youtube-nocookie.com',
    videoId: '${videoId}',
    width: '100%', height: '100%',
    playerVars: { autoplay: 1, playsinline: 1, rel: 0, origin: '${YOUTUBE_PLAYER_ORIGIN}' },
    events: {
      onReady: function(e){ envoyer({ type: 'ready' }); e.target.playVideo(); },
      onStateChange: function(e){ envoyer({ type: 'state', state: e.data }); },
      onError: function(e){ envoyer({ type: 'error', code: e.data }); }
    }
  });
}
</script>
<script src="https://www.youtube.com/iframe_api" onerror="envoyer({ type: 'network' })"></script>
</body></html>`;
};

/**
 * Codes d'erreur du lecteur YouTube → ce que l'écran dit (planche M9).
 * 100 : vidéo privée ou supprimée ; 101, 150, 153 : lecture hors de YouTube refusée.
 * @param {unknown} code
 * @returns {'unavailable' | 'embed'}
 */
export const youtubeErrorKind = (code) => (Number(code) === 100 ? 'unavailable' : 'embed');
