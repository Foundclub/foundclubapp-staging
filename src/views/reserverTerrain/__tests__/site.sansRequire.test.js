const fs = require('fs');
const path = require('path');

// RESA-L6A (14/10/2026) — LE SITE COMPILE CES FICHIERS (web/vite.config.ts pointe ../app/src).
// Son serveur de dev les sert tels quels au navigateur, où `require` n'existe pas : un `require`
// y donne « ReferenceError: require is not defined » — au chargement s'il est en tête du module,
// dès que son chemin s'exécute s'il est dans une fonction. notificationNavigation.js est chargé
// sur TOUTES les pages du site (web/src/bridge/WebPushNotificationsHost.tsx), SearchHubScreen.js
// par la recherche du site (web/src/pages/seo/RechercheUnique.tsx). Le greffon du site ne
// traduit que les `require` d'IMAGES (vite.config.ts, « foundclub-app-require-images »).
// Témoin : AUCUN `require(` (hors image, hors commentaire) dans les fichiers que ce lot a touchés
// et que le site compile, ou compilera avec le lot web L7 (+ complexeService.js de RESA-L5A1, à la
// demande du chef de soutien, 14/10). N'en sont pas : PrivateNavigator.js
// (le site a son propre registre d'écrans, web/src/routes/screenRegistry.tsx) et
// webRouteExemptions.js (module CommonJS que le site ne compile pas : son script de couverture
// des routes le LIT comme un texte, web/scripts/check-web-route-coverage.mjs).

const SRC = path.resolve(__dirname, '..', '..', '..');

const FICHIERS = [
  'components/molecules/searchTypeSwitcher/SearchTypeSwitcher.js',
  'config/fonctionsMasquees.js',
  'domains/auth/authUseCases.js',
  'domains/complexe/reserverTerrain.js',
  'navigation/routeNames.js',
  'services/complexe/complexeJoueurQueries.js',
  'services/complexe/complexeJoueurService.js',
  'services/complexe/complexeService.js',
  'services/reservation/reservationService.js',
  'utils/notifications/notificationNavigation.js',
  'utils/notifications/notificationPresentation.js',
  'views/complexe/components/PastilleMode.js',
  'views/event/EventDetails.js',
  'views/search/SearchHubScreen.js',
  // RESA-CARTE (20/10) : l'adresse du site /search/reservations monte la recherche de terrains.
  'views/search/SearchReservationsScreen.js',
];

const vues = (dossier) => fs.readdirSync(dossier, { withFileTypes: true }).flatMap((entree) => {
  const chemin = path.join(dossier, entree.name);
  if (entree.isDirectory()) return entree.name === '__tests__' ? [] : vues(chemin);
  if (!entree.name.endsWith('.js')) return [];
  return [path.relative(SRC, chemin).split(path.sep).join('/')];
});

const TOUS = [...FICHIERS, ...vues(path.join(SRC, 'views', 'reserverTerrain'))];

const IMAGE = /require\(\s*['"][^'"]+\.(png|jpe?g|gif|webp|svg)['"]\s*\)/g;

// Les SEULES lignes tolérées, et pourquoi (décision du chef de soutien, 14/10) : le client HTTP de
// complexeService.js (RESA-L5A1) et son service des fermetures restent chargés à l'appel. Importés
// en tête, ils font échouer au chargement 10 suites de témoins dans toute copie de travail sans
// `.env` ; un `import()` dynamique, jest ne l'exécute pas. Le site ne les appelle pas
// avant L7.
const TOLEREES = {
  'services/complexe/complexeService.js': [
    "const client = () => require('../client').default;",
    "const fermetures = () => require('../facilityClosure/facilityClosureService');",
  ],
};

describe('RESA-L6A — aucun `require` dans un fichier que le site compile', () => {
  it.each(TOUS)('%s', (fichier) => {
    const lignes = fs.readFileSync(path.join(SRC, fichier), 'utf8').split('\n');
    const tolerees = TOLEREES[fichier] || [];
    const fautives = lignes.filter((ligne) => {
      const code = ligne.trim();
      if (tolerees.includes(code)) return false;
      if (code.startsWith('//') || code.startsWith('*') || code.startsWith('/*')) return false;
      return /\brequire\(/.test(code.replace(IMAGE, ''));
    });
    expect(fautives).toEqual([]);
  });
});
