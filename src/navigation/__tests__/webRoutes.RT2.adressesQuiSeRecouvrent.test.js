import { RouteNames } from '../routeNames';
import { buildWebPath, WEB_ROUTE_PATTERNS } from '../webRoutes';

// RETOURS-TESTEUR-2 (06/11/2026, défaut 1 de CR-TRAIN5) — « Ajouter une installation » n'ouvrait
// rien sur le site : le formulaire sans identifiant rendait `/facilities?clubId=…`, l'adresse de
// la LISTE (`/facilities`), et le routeur du site (react-router) départage deux adresses égales
// par leur ordre : la liste gagnait. Ce témoin passe TOUTES les adresses : une adresse à
// paramètre facultatif, vidée de ce paramètre, ne doit être l'adresse d'aucun autre écran.

const segments = (adresse) => adresse.split('/').filter(Boolean);

// Les formes qu'un motif accepte : chaque paramètre facultatif présent ou absent.
const formes = (motif) => segments(motif).reduce(
  (acc, segment) => (segment.endsWith('?')
    ? acc.flatMap((forme) => [forme, [...forme, segment.slice(0, -1)]])
    : acc.map((forme) => [...forme, segment])),
  [[]],
);

// Deux formes sont la même adresse : mêmes segments fixes, paramètres aux mêmes places.
const meme = (a, b) => a.length === b.length && a.every((s, i) => (
  s.startsWith(':') ? b[i].startsWith(':') : s === b[i]));

describe('RETOURS-TESTEUR-2 — aucune adresse vidée ne tombe sur un autre écran', () => {
  const motifs = Object.entries(WEB_ROUTE_PATTERNS);
  const facultatifs = motifs.filter(([, motif]) => motif.includes('?'));

  it.each(facultatifs)('%s (%s) : vidée, elle reste à lui seul', (route, motif) => {
    const videe = segments(motif).filter((s) => !s.endsWith('?'));
    const autres = motifs
      .filter(([nom]) => nom !== route)
      .filter(([, autre]) => formes(autre).some((forme) => meme(forme, videe)))
      .map(([nom]) => nom);
    expect(autres).toEqual([]);
  });

  it('le formulaire d installation, sans identifiant, n a pas l adresse de la liste', () => {
    const formulaire = buildWebPath(RouteNames.FacilityForm, { clubId: 'c1' });
    const liste = buildWebPath(RouteNames.FacilityList, { clubId: 'c1' });
    expect(formulaire.split('?')[0]).not.toBe(liste.split('?')[0]);
  });
});
