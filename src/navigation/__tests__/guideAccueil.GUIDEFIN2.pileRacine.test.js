import fs from 'fs';
import path from 'path';

import {
  createNavigatorFactory,
  NavigationContainer,
  useNavigationBuilder,
} from '@react-navigation/native';
import { StackRouter, TabRouter } from '@react-navigation/routers';
import { createElement } from 'react';
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { COACH_GUIDE } from '@/domains/tour/coachGuide';
import { TOUR_HOME_TARGET } from '@/domains/tour/tourCatalog';

import { RouteNames } from '@/navigation/routeNames';

/**
 * GUIDE-FINITIONS-2 (rejeu du guide Entraîneur, 28/10, N7) : à la clôture,
 * « Aller à l'accueil » arrivait sur l'onglet PLANNING (capture 61).
 *
 * 🔎 La cible « accueil » du guide nommait `SearchHome` comme un ONGLET
 * (`HomeTab › SearchHome`), alors qu'il vit dans l'onglet `Search`
 * (`HomeTab › Search › SearchHome`, voir `allerDansLOnglet.js`). Le routeur
 * d'onglets ne le connaît pas : l'onglet au premier plan (Planning) restait.
 *
 * Vrais routeurs, comme `allerDansLOnglet.pileRacine.test.js` : un espion sur
 * `navigate` serait vert des deux côtés.
 */

const PILE_ACCUEIL = path.join(__dirname, '..', 'private', 'stacks', 'SearchStack.js');
const ROUTES_ACCUEIL = [
  ...fs.readFileSync(PILE_ACCUEIL, 'utf8').matchAll(/name=\{RouteNames\.(\w+)\}/g),
].map((m) => m[1]);

/**
 * Barre d'onglets minimale sur le VRAI `TabRouter`.
 * @param {any} props - Props du navigateur.
 * @returns {any} Contenu.
 */
function BarreOnglets(props) {
  const { descriptors, NavigationContent, state } = useNavigationBuilder(TabRouter, props);
  return createElement(
    NavigationContent,
    null,
    state.routes.map((/** @type {any} */ route) => descriptors[route.key].render()),
  );
}

/**
 * Pile minimale sur le VRAI `StackRouter`.
 * @param {any} props - Props du navigateur.
 * @returns {any} Contenu.
 */
function PileMinimale(props) {
  const { descriptors, NavigationContent, state } = useNavigationBuilder(StackRouter, props);
  return createElement(
    NavigationContent,
    null,
    state.routes.map((/** @type {any} */ route) => descriptors[route.key].render()),
  );
}

const Onglets = createNavigatorFactory(BarreOnglets)();
const Pile = createNavigatorFactory(PileMinimale)();
const Racine = createNavigatorFactory(PileMinimale)();

const Ecran = (/** @type {string} */ nom) => function EcranTemoin() {
  return createElement(Text, null, nom);
};

/**
 * L'onglet d'accueil, avec les routes de SearchStack.js.
 * @returns {any} Pile.
 */
function PileAccueil() {
  return createElement(
    Pile.Navigator,
    { id: undefined, initialRouteName: RouteNames.SearchHome },
    ...ROUTES_ACCUEIL.map((nom) => createElement(Pile.Screen, {
      component: Ecran(nom), key: nom, name: nom,
    })),
  );
}

/**
 * Les onglets de PrivateTabNavigator (Accueil, Planning, Équipes).
 * @returns {any} Onglets.
 */
function OngletsPrives() {
  return createElement(
    Onglets.Navigator,
    { id: undefined, initialRouteName: RouteNames.Search },
    createElement(Onglets.Screen, { component: PileAccueil, key: 'a', name: RouteNames.Search }),
    createElement(Onglets.Screen, {
      component: Ecran(RouteNames.MyEventList), key: 'p', name: RouteNames.MyEventList,
    }),
    createElement(Onglets.Screen, {
      component: Ecran(RouteNames.MyTeamList), key: 'e', name: RouteNames.MyTeamList,
    }),
  );
}

/** @type {any} */
let conteneur = null;
/** @type {any} */
let arbre = null;

const monter = () => {
  act(() => {
    arbre = renderer.create(createElement(
      NavigationContainer,
      { ref: (/** @type {any} */ reference) => { if (reference) conteneur = reference; } },
      createElement(
        Racine.Navigator,
        { id: undefined, initialRouteName: RouteNames.HomeTab },
        createElement(Racine.Screen, {
          component: OngletsPrives, key: 'o', name: RouteNames.HomeTab,
        }),
        createElement(Racine.Screen, {
          component: Ecran(RouteNames.ProfileStack), key: 'm', name: RouteNames.ProfileStack,
        }),
        createElement(Racine.Screen, {
          component: Ecran(RouteNames.EventStack), key: 'v', name: RouteNames.EventStack,
        }),
      ),
    ));
  });
};

/**
 * Le geste du guide (`navigateToTarget` de TourContext), tel quel.
 * @param {any} target - Cible du catalogue.
 * @returns {void}
 */
const allerVers = (target) => act(() => {
  conteneur.navigate(target.routeName, target.params, { pop: true });
});

/**
 * L'écran vu : racine › onglet au premier plan › haut de sa pile.
 * @returns {string[]} Chemin.
 */
const ecranVu = () => {
  const racine = conteneur.getRootState();
  const top = racine.routes[racine.index];
  if (top.name !== RouteNames.HomeTab) return [top.name];
  const onglet = top.state.routes[top.state.index];
  const pile = onglet.state;
  return [top.name, onglet.name, ...(pile ? [pile.routes[pile.index].name] : [])];
};

const stepTarget = (/** @type {string} */ id) => COACH_GUIDE.steps
  .find((/** @type {any} */ step) => step.id === id).navTarget;

describe('GUIDE-FINITIONS-2 N7 — « Aller à l’accueil » arrive sur l’accueil', () => {
  afterEach(() => {
    if (arbre) act(() => arbre.unmount());
    arbre = null;
    conteneur = null;
  });

  it('les routes de l’accueil sont bien lues', () => {
    expect(ROUTES_ACCUEIL[0]).toBe(RouteNames.SearchHome);
  });

  it('bonus relancé depuis Mon compte, B2 sur le Planning, puis clôture : l’accueil', () => {
    monter();
    act(() => { conteneur.navigate(RouteNames.ProfileStack); });
    // « Faire un bonus » : b1-dock (accueil), puis b2-dock (Planning), puis le match d'exemple.
    allerVers(stepTarget('b1-dock'));
    expect(ecranVu()).toEqual([RouteNames.HomeTab, RouteNames.Search, RouteNames.SearchHome]);
    allerVers(stepTarget('b2-dock'));
    expect(ecranVu()).toEqual([RouteNames.HomeTab, RouteNames.MyEventList]);
    act(() => { conteneur.navigate(RouteNames.EventStack); });

    // Clôture : « Aller à l'accueil » (finishGuide).
    allerVers(TOUR_HOME_TARGET);

    expect(conteneur.getRootState().routes.map((r) => r.name)).toEqual([RouteNames.HomeTab]);
    expect(ecranVu()).toEqual([RouteNames.HomeTab, RouteNames.Search, RouteNames.SearchHome]);
  });
});
