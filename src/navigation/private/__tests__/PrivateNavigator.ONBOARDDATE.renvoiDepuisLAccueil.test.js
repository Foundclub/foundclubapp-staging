/* eslint-disable max-len -- des phrases entieres */
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

import { getCurrentRouteTrail, navigationRef } from '@/navigation/navigationService';
import { RouteNames } from '@/navigation/routeNames';

// ONBOARDDATE (29/10/2026) — le renvoi au parcours d'inscription (PrivateNavigator) ne part que
// « depuis l'accueil ». Il comparait l'ecran AFFICHE (`getCurrentRoute`, la feuille) a HomeTab ;
// or HomeTab est la pile racine qui contient les onglets, puis la pile d'accueil : sur l'accueil,
// l'ecran affiche s'appelle SearchHome. La comparaison ne valait donc jamais : un compte inacheve
// dont le parcours apparait apres le montage restait sur l'accueil, sans parcours.
// Vrais routeurs de la bibliotheque, vues minimales (motif de allerDansLOnglet.pileRacine.test.js).

/**
 * Une pile minimale sur le VRAI `StackRouter`.
 * @param {any} props - Les props du navigateur.
 * @returns {any} Le contenu de navigation.
 */
function PileMinimale(props) {
  const { descriptors, NavigationContent, state } = useNavigationBuilder(StackRouter, props);
  const ecran = descriptors[state.routes[state.index].key];
  return createElement(NavigationContent, null, ecran.render());
}

/**
 * Des onglets minimaux sur le VRAI `TabRouter`.
 * @param {any} props - Les props du navigateur.
 * @returns {any} Le contenu de navigation.
 */
function OngletsMinimaux(props) {
  const { descriptors, NavigationContent, state } = useNavigationBuilder(TabRouter, props);
  return createElement(NavigationContent, null, descriptors[state.routes[state.index].key].render());
}

const Racine = createNavigatorFactory(PileMinimale)();
const Onglets = createNavigatorFactory(OngletsMinimaux)();
const Accueil = createNavigatorFactory(PileMinimale)();

const Ecran = (/** @type {string} */ nom) => function EcranTemoin() {
  return createElement(Text, null, nom);
};

// La forme de l'app : HomeTab (PrivateNavigator) > Search (PrivateTabNavigator) > SearchHome (SearchStack).
/**
 * La pile d'accueil (SearchStack).
 * @returns {any} Le navigateur.
 */
function PileAccueil() {
  return createElement(
    Accueil.Navigator,
    { id: undefined },
    createElement(Accueil.Screen, { component: Ecran(RouteNames.SearchHome), name: RouteNames.SearchHome }),
  );
}
/**
 * Les onglets (PrivateTabNavigator).
 * @returns {any} Le navigateur.
 */
function OngletsPrives() {
  return createElement(
    Onglets.Navigator,
    { id: undefined },
    createElement(Onglets.Screen, { component: PileAccueil, name: RouteNames.Search }),
  );
}

it('sur l accueil, l ecran affiche est SearchHome, la racine est HomeTab', async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(createElement(
      NavigationContainer,
      { ref: navigationRef },
      createElement(
        Racine.Navigator,
        { id: undefined },
        createElement(Racine.Screen, { component: OngletsPrives, name: RouteNames.HomeTab }),
      ),
    ));
  });

  expect(navigationRef.getCurrentRoute()?.name).toBe(RouteNames.SearchHome);
  expect(getCurrentRouteTrail()[0]).toBe(RouteNames.HomeTab);
  await act(async () => arbre.unmount());
});

it('🔴 le renvoi au parcours lit la RACINE de la pile, pas l ecran affiche', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'PrivateNavigator.js'), 'utf8');
  const debut = source.indexOf('const shouldRedirectFromHome');
  const effet = source.slice(debut - 300, debut + 300);

  expect(effet).not.toMatch(/getCurrentRoute\(\)/);
  expect(effet).toMatch(/getCurrentRouteTrail\(\)\[0\]/);
});
