/**
 * MSG-MEDIA (29/10) — la page que charge la WebView du lecteur : une seule balise <video>.
 * Le moteur de la page (WKWebView sur iPhone, Chromium sur Android) lit le fichier lui-même :
 * aucune bibliothèque vidéo n'entre dans l'app.
 */

/**
 * Échappe une valeur pour un attribut HTML.
 * @param {string} value
 * @returns {string} La valeur sûre dans un attribut HTML entre guillemets doubles.
 */
const enAttribut = (value) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/"/g, '&quot;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

/**
 * Construit la page du lecteur.
 * @param {string} url - L'adresse publique du fichier (stockage objet).
 * @returns {string} Le document HTML complet.
 */
export const buildVideoPage = (url) => [
  '<!doctype html><html><head>',
  '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">',
  '<style>html,body{margin:0;height:100%;background:black}',
  'video{width:100%;height:100%;object-fit:contain;background:black}</style>',
  '</head><body>',
  `<video src="${enAttribut(url)}" controls autoplay playsinline preload="metadata"></video>`,
  '<script>',
  'document.querySelector("video").addEventListener("error",function(){',
  'window.ReactNativeWebView&&window.ReactNativeWebView.postMessage("error");});',
  '</script>',
  '</body></html>',
].join('');

export default buildVideoPage;
