import fs from 'fs';
import path from 'path';

import allerDansLOnglet from '../allerDansLOnglet';
import { RouteNames } from '../routeNames';

/**
 * 🔴 LE DEFAUT QUE CE FILET FERME, mesure a l ecran le 2026-09-08.
 *
 * On repondait aux cinq questions de forme, on appuyait sur « Commencer ma seance »
 * — et RIEN. Le verdict partait bien au serveur, la seance passait « en cours »,
 * mais l ecran ne bougeait pas. Le journal de l appareil disait :
 *
 *   The action 'NAVIGATE' with payload {"name":"TrainingSessionNow",...}
 *   was not handled by any navigator. Do you have a screen named ... ?
 *
 * SIX navigations etaient mortes de la meme facon, dans quatre ecrans.
 *
 * 🔎 LA CAUSE. Les ecrans de TACHE vivent sur la pile RACINE — c est ce qui cache
 * le dock, et c est le motif maison. Les ecrans de CONSULTATION vivent dans
 * `SearchStack`, DEUX niveaux plus bas. `navigate` remonte vers les parents ; il ne
 * descend jamais chez un voisin.
 *
 * ⚠️ AUCUNE PORTE NE POUVAIT LE VOIR : ce n est ni une erreur de type, ni une regle
 * de style, ni un test de rendu — l ecran se monte parfaitement, c est le GESTE qui
 * ne mene nulle part. Seul un filet qui relit l ARBRE de navigation l attrape.
 */

const RACINE = path.join(__dirname, '..', 'private', 'PrivateNavigator.js');
const ONGLET = path.join(__dirname, '..', 'private', 'stacks', 'SearchStack.js');

/**
 * Les routes declarees par un fichier de navigation.
 * @param {string} fichier le chemin du fichier
 * @returns {Set<string>} les noms de routes qu il monte
 */
const routesDe = (fichier) => {
  const source = fs.readFileSync(fichier, 'utf8');
  return new Set([...source.matchAll(/name=\{RouteNames\.(\w+)\}/g)].map((m) => m[1]));
};

describe('la forme imbriquee', () => {
  it('nomme le chemin complet : onglet d accueil, puis la pile, puis l ecran', () => {
    const navigation = { navigate: jest.fn() };

    allerDansLOnglet(navigation, RouteNames.TrainingSessionNow, { sessionId: 'abc' });

    expect(navigation.navigate).toHaveBeenCalledWith(RouteNames.HomeTab, {
      params: { params: { sessionId: 'abc' }, screen: RouteNames.TrainingSessionNow },
      screen: RouteNames.Search,
    });
  });

  it('accepte un ecran sans parametre', () => {
    const navigation = { navigate: jest.fn() };

    allerDansLOnglet(navigation, RouteNames.TrainingVideoQueue);

    expect(navigation.navigate.mock.calls[0][1].params.params).toBeUndefined();
  });
});

describe('🚨 AUCUN ECRAN DE LA RACINE N APPELLE DIRECTEMENT UN ECRAN D ONGLET', () => {
  const surLaRacine = routesDe(RACINE);
  const dansLOnglet = routesDe(ONGLET);

  it('les deux piles sont bien lues (sinon ce filet ne mesure rien)', () => {
    // Un filet qui lit un fichier deplace passerait au vert sans rien verifier.
    expect(surLaRacine.size).toBeGreaterThan(20);
    expect(dansLOnglet.size).toBeGreaterThan(10);
    expect(surLaRacine.has('TrainingFreshness')).toBe(true);
    expect(dansLOnglet.has('TrainingSessionNow')).toBe(true);
  });

  it.each([
    'training/TrainingFreshness',
    'training/TrainingGuided',
    'training/TrainingVideoEntry',
    'training/TrainingSchema',
    'training/TrainingTest',
  ])('%s ne vise aucun ecran d onglet en direct', (relatif) => {
    const chemin = path.join(__dirname, '..', '..', 'views', `${relatif}.js`);
    const source = fs.readFileSync(chemin, 'utf8');
    const directes = [...source.matchAll(/navigation\.navigate\(RouteNames\.(\w+)/g)]
      .map((m) => m[1])
      .filter((route) => dansLOnglet.has(route) && !surLaRacine.has(route));

    // Le message porte le nom de la route : sur le terrain, c est ce qu on cherche.
    expect(directes).toEqual([]);
  });
});
