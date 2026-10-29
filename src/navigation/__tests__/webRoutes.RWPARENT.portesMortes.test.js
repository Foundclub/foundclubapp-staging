import fs from 'fs';
import path from 'path';

import { RouteNames } from '../routeNames';
import { buildWebPath, isWebRouteSupported } from '../webRoutes';

// RW-PARENT (29/10, recette du site) — DES BOUTONS MORTS SUR LE SITE. Sur l'accueil, les trois
// cartes « Mon entraînement » et, dans le profil, « Personnes bloquées » appelaient
// `navigation.navigate` vers un écran exempté du site (webRouteExemptions.js) : le site ne
// faisait RIEN, ou revenait à l'accueil, sans un mot. Les portes de ces deux écrans passent
// par `navigateOrExplainOnWeb` (« Bientôt sur le site »), comme « Relier le compte de mon
// enfant ». Témoin : dans ces fichiers, aucun `navigation.navigate(RouteNames.X…)` direct ne
// vise un écran sans adresse sur le site.
const FICHIERS = ['views/home/HomeHub.js', 'views/profile/Profile.js'];

// ponytail: `CollectiviteSpace` (onglets de la Ville, rôle mairie) part lui aussi sans adresse
// (Profile.js « Ma collectivité ») : hors du rôle Parent, rendu au chef, pas corrigé ici.
const HORS_LOT = ['CollectiviteSpace'];

/**
 * Les écrans visés par un `navigation.navigate(...)` direct (ternaire compris). Un appel qui
 * nomme un écran imbriqué (`{ screen: … }`) est résolu par l'adaptateur du site : écarté.
 * @param {string} source - Le code.
 * @returns {string[]} Les noms d'écran.
 */
const ecransVises = (source) => [...source.matchAll(/navigation\??\.navigate\(([^;]*?)\)/gs)]
  .filter((appel) => !/\bscreen:/.test(appel[1]))
  .flatMap((appel) => [...appel[1].split(',')[0].matchAll(/RouteNames\.(\w+)/g)].map((m) => m[1]))
  .filter((nom) => !HORS_LOT.includes(nom));

describe('RW-PARENT — aucune porte morte sur le site depuis l accueil et le profil', () => {
  it.each(FICHIERS)('🔴 %s : chaque navigate direct vise un écran qui a une adresse', (fichier) => {
    const source = fs.readFileSync(path.join(__dirname, '..', '..', fichier), 'utf8');
    const sansAdresse = ecransVises(source).filter((nom) => (
      !isWebRouteSupported(RouteNames[nom]) && buildWebPath(RouteNames[nom]) === '/'
    ));

    expect(sansAdresse).toEqual([]);
  });
});
