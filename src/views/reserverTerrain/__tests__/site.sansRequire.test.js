const fs = require('fs');
const path = require('path');

// RESA-L6A (14/10/2026) — LE SITE COMPILE CES FICHIERS (web/vite.config.ts pointe ../app/src).
// Son serveur de dev les sert tels quels au navigateur, où `require` n'existe pas : un `require`
// posé en tête de module (exécuté au chargement) y donne « ReferenceError: require is not
// defined ». notificationNavigation.js est chargé sur TOUTES les pages du site
// (web/src/bridge/WebPushNotificationsHost.tsx), SearchHubScreen.js par la recherche du site
// (web/src/pages/seo/RechercheUnique.tsx). Le greffon du site ne traduit que les `require`
// d'IMAGES (vite.config.ts, « foundclub-app-require-images »).
// Témoin : aucun `require` en tête de module dans les fichiers que ce lot a touchés et que le
// site charge (ou chargera avec le lot web L7).

const SRC = path.resolve(__dirname, '..', '..', '..');

const FICHIERS = [
  'utils/notifications/notificationNavigation.js',
  'utils/notifications/notificationPresentation.js',
  'views/search/SearchHubScreen.js',
  'components/molecules/searchTypeSwitcher/SearchTypeSwitcher.js',
  'views/complexe/components/PastilleMode.js',
  'views/event/EventDetails.js',
  'domains/auth/authUseCases.js',
  'domains/complexe/reserverTerrain.js',
  'services/complexe/complexeJoueurService.js',
  'services/complexe/complexeJoueurQueries.js',
];

const vues = (dossier) => fs.readdirSync(dossier, { withFileTypes: true }).flatMap((entree) => {
  const chemin = path.join(dossier, entree.name);
  if (entree.isDirectory()) return entree.name === '__tests__' ? [] : vues(chemin);
  if (!entree.name.endsWith('.js')) return [];
  return [path.relative(SRC, chemin).split(path.sep).join('/')];
});

const TOUS = [...FICHIERS, ...vues(path.join(SRC, 'views', 'reserverTerrain'))];

describe('RESA-L6A — aucun `require` au chargement dans un fichier que le site compile', () => {
  it.each(TOUS)('%s', (fichier) => {
    const texte = fs.readFileSync(path.join(SRC, fichier), 'utf8');
    // En tête de module = en colonne 0, affecté DIRECTEMENT (`const x = require(…)`) ; une
    // fonction qui charge à l'appel (`const client = () => require(…)`) ne tourne pas au
    // chargement.
    const direct = /^(const|let|var)\b[^=]*=\s*require\(/;
    const enTete = texte.split('\n').filter((ligne) => direct.test(ligne));
    expect(enTete).toEqual([]);
  });
});
