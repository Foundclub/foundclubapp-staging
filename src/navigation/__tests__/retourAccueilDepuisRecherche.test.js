import {
  CommonActions,
  createNavigatorFactory,
  NavigationContainer,
  useNavigationBuilder,
} from '@react-navigation/native';
import { StackRouter, TabRouter } from '@react-navigation/routers';
import { createElement } from 'react';
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { navigateToSearchHub } from '@/views/search/searchRouteHelpers';

import { createFocusedTabResetListener } from '@/navigation/tabRootReset';

// Filet AA04 ① (E6) — « J'AI CREE UN COMPTE ENTRAINEUR SANS CLUB, ET QUAND JE
// CLIQUE SUR L'ACCUEIL APRES AVOIR CLIQUE DANS "TROUVER UN CLUB" DANS L'ONGLET
// EQUIPES, JE RESTE BLOQUE DANS LA RECHERCHE ET JE NE PEUX PLUS RETOURNER DANS
// L'ACCUEIL, SAUF EN FERMANT ET ROUVRANT L'APP » (Adel, 2026-08-20).
//
// 🧨 POURQUOI DE VRAIS ROUTEURS ET PAS UN ESPION SUR `navigate` : le defaut
// n'est PAS un appel manquant, c'est un ETAT. `navigateToSearchHub` fait
// exactement ce qu'on lui demande — il bascule sur l'onglet Accueil et y EMPILE
// la recherche. Un `expect(navigate).toHaveBeenCalled()` est vert des deux
// cotes du correctif ; seule la pile les separe. Meme motif que les filets D24
// et D81.
//
// La barre d'onglets reproduite ci-dessous est celle de la bibliotheque, au mot
// pres (`@react-navigation/bottom-tabs/src/views/BottomTabBar.tsx`, l. 399-412) :
// quand l'onglet presse est DEJA au premier plan, elle ne dispatche RIEN.

/**
 * Une barre d'onglets minimale, batie sur le VRAI `TabRouter`, et dont le
 * bouton se comporte comme celui de la bibliotheque.
 *
 * ⚠️ Elle rend TOUS ses onglets, comme `BottomTabView` : un onglet quitte reste
 * MONTE. Ne rendre que celui du premier plan changerait la mesure — la pile
 * demontee perd son ecran racine, et `navigateToSearchHub` reconstruit alors
 * une pile qui commence DIRECTEMENT par la recherche.
 * @param {any} props - Les props du navigateur.
 * @returns {any} Le contenu de navigation.
 */
function BarreOnglets(props) {
  const {
    descriptors, navigation, NavigationContent, state,
  } = useNavigationBuilder(TabRouter, props);

  return createElement(
    NavigationContent,
    null,
    state.routes.map((/** @type {any} */ route, /** @type {number} */ index) => createElement(
      Text,
      {
        accessibilityRole: 'button',
        key: route.key,
        onPress: () => {
          const evenement = navigation.emit({
            canPreventDefault: true,
            target: route.key,
            type: 'tabPress',
          });
          if (index !== state.index && !evenement.defaultPrevented) {
            navigation.dispatch({ ...CommonActions.navigate(route), target: state.key });
          }
        },
        testID: `onglet-${route.name}`,
      },
      descriptors[route.key].render(),
    )),
  );
}

/**
 * Une pile minimale batie sur le VRAI `StackRouter`.
 * @param {any} props - Les props du navigateur.
 * @returns {any} Le contenu de navigation.
 */
function PileMinimale(props) {
  const { descriptors, NavigationContent, state } = useNavigationBuilder(StackRouter, props);
  return createElement(
    NavigationContent,
    null,
    state.routes.map((/** @type {any} */ route) => descriptors[route.key].render()),
  );
}

const creerOnglets = createNavigatorFactory(BarreOnglets);
const creerPile = createNavigatorFactory(PileMinimale);
const Onglets = creerOnglets();
const Pile = creerPile();
const Racine = creerPile();

/**
 * Un ecran temoin : il affiche son nom, rien d'autre.
 * @param {string} nom - Le nom de la route.
 * @returns {any} Le composant d'ecran.
 */
const Ecran = (nom) => function EcranTemoin() {
  return createElement(Text, null, nom);
};

/**
 * L'onglet « Accueil » : ce n'est PAS un ecran, c'est une pile dont la racine
 * est le hub d'accueil et sur laquelle la recherche s'empile.
 * @returns {any} La pile de l'onglet Accueil.
 */
function PileAccueil() {
  return createElement(
    Pile.Navigator,
    { id: undefined, initialRouteName: 'SearchHome' },
    createElement(Pile.Screen, { component: Ecran('SearchHome'), key: 'a', name: 'SearchHome' }),
    createElement(Pile.Screen, { component: Ecran('SearchHub'), key: 'b', name: 'SearchHub' }),
    createElement(Pile.Screen, {
      component: Ecran('MyActivities'), key: 'c', name: 'MyActivities',
    }),
  );
}

/** @type {any} */
let navigationEquipes = null;

/**
 * L'onglet « Equipes ». Il capture sa navigation : c'est de LA qu'Adel part.
 * @param {any} props - Les props d'ecran.
 * @returns {any} L'ecran temoin.
 */
function OngletEquipes({ navigation }) {
  navigationEquipes = navigation;
  return createElement(Text, null, 'MyTeamList');
}

/**
 * Les onglets, cables comme `PrivateTabNavigator`.
 * @returns {any} Le navigateur d'onglets.
 */
function Onglets4() {
  return createElement(
    Onglets.Navigator,
    { id: undefined, initialRouteName: 'Search' },
    createElement(Onglets.Screen, {
      component: PileAccueil,
      key: 'accueil',
      listeners: createFocusedTabResetListener,
      name: 'Search',
    }),
    createElement(Onglets.Screen, {
      component: OngletEquipes,
      key: 'equipes',
      listeners: createFocusedTabResetListener,
      name: 'MyTeamList',
    }),
  );
}

/** @type {any} */
let conteneur = null;
/** @type {any} */
let arbre = null;

/**
 * Monte l'application reduite : la racine, les onglets, la pile d'accueil.
 * @returns {void}
 */
const monter = () => {
  act(() => {
    arbre = renderer.create(createElement(
      NavigationContainer,
      { ref: (/** @type {any} */ reference) => { if (reference) conteneur = reference; } },
      createElement(
        Racine.Navigator,
        { id: undefined, initialRouteName: 'HomeTab' },
        createElement(Racine.Screen, { component: Onglets4, key: 'onglets', name: 'HomeTab' }),
      ),
    ));
  });
};

/**
 * L'etat de la pile de l'onglet Accueil, tel que le routeur la connait.
 * @returns {string[]} Les routes empilees, dans l'ordre.
 */
const pileAccueil = () => {
  const onglets = conteneur.getRootState().routes
    .find((/** @type {any} */ route) => route.name === 'HomeTab')?.state;
  const accueil = onglets?.routes
    ?.find((/** @type {any} */ route) => route.name === 'Search')?.state;
  return accueil ? accueil.routes.map((/** @type {any} */ route) => route.name) : ['SearchHome'];
};

/**
 * Le nom de l'onglet au premier plan.
 * @returns {string} Le nom de la route d'onglet active.
 */
const ongletActif = () => {
  const onglets = conteneur.getRootState().routes
    .find((/** @type {any} */ route) => route.name === 'HomeTab')?.state;
  return onglets ? onglets.routes[onglets.index].name : 'Search';
};

/**
 * Appuie sur un onglet de la barre, comme le doigt le fait.
 * @param {string} nom - Le nom de la route d'onglet.
 * @returns {void}
 */
const appuyerSurOnglet = (nom) => {
  const bouton = arbre.root.findByProps({ testID: `onglet-${nom}` });
  act(() => { bouton.props.onPress(); });
};

/**
 * Le geste d'Adel : depuis l'onglet Equipes, « trouver un club ». C'est le VRAI
 * utilitaire de l'app (`TeamListContent.handleOpenClubSearch`).
 * @returns {void}
 */
const trouverUnClub = () => {
  act(() => { navigateToSearchHub(navigationEquipes, 'clubs'); });
};

describe('AA04 ① — depuis la recherche de club, on revient a l accueil', () => {
  beforeEach(() => {
    conteneur = null;
    navigationEquipes = null;
  });

  afterEach(() => {
    if (arbre) act(() => arbre.unmount());
    arbre = null;
  });

  it('« trouver un club » bascule sur l onglet Accueil ET y empile la recherche', () => {
    monter();
    appuyerSurOnglet('MyTeamList');
    expect(ongletActif()).toBe('MyTeamList');

    trouverUnClub();

    // C'est TOUT le defaut : la recherche n'est pas un onglet, c'est un ecran
    // pose PAR-DESSUS l'accueil, dans l'onglet Accueil.
    expect(ongletActif()).toBe('Search');
    expect(pileAccueil()).toEqual(['SearchHome', 'SearchHub']);
  });

  it('un appui sur « Accueil » ramene a l accueil', () => {
    monter();
    appuyerSurOnglet('MyTeamList');
    trouverUnClub();

    appuyerSurOnglet('Search');

    expect(pileAccueil()).toEqual(['SearchHome']);
  });

  it('le bouton du telephone fait la meme chose que le bouton de l ecran', () => {
    monter();
    appuyerSurOnglet('MyTeamList');
    trouverUnClub();
    act(() => conteneur.goBack());
    const apresLeBoutonDuTelephone = pileAccueil();

    act(() => arbre.unmount());
    arbre = null;
    monter();
    appuyerSurOnglet('MyTeamList');
    trouverUnClub();
    appuyerSurOnglet('Search');

    expect(pileAccueil()).toEqual(apresLeBoutonDuTelephone);
    expect(apresLeBoutonDuTelephone).toEqual(['SearchHome']);
  });

  it('quelle que soit la profondeur, aucun ecran de l accueil n est sans issue', () => {
    monter();
    appuyerSurOnglet('MyTeamList');
    trouverUnClub();
    act(() => {
      conteneur.navigate('HomeTab', {
        params: { screen: 'MyActivities' },
        screen: 'Search',
      });
    });
    expect(pileAccueil()).toEqual(['SearchHome', 'SearchHub', 'MyActivities']);

    appuyerSurOnglet('Search');

    expect(pileAccueil()).toEqual(['SearchHome']);
  });

  it('un onglet qui n est PAS au premier plan bascule, il ne depile rien', () => {
    monter();
    appuyerSurOnglet('MyTeamList');
    trouverUnClub();
    appuyerSurOnglet('MyTeamList');

    // On revient sur Equipes : la recherche doit rester ou elle est, sinon on
    // ferait perdre sa place a quelqu'un qui fait un aller-retour.
    expect(ongletActif()).toBe('MyTeamList');
    expect(pileAccueil()).toEqual(['SearchHome', 'SearchHub']);
  });

  it('🪤 un second « trouver un club » RAMENE sur la recherche deja empilee', () => {
    monter();
    appuyerSurOnglet('MyTeamList');
    trouverUnClub();
    appuyerSurOnglet('MyTeamList');
    trouverUnClub();

    // Piege D19 : `navigate` vers un ecran DEJA empile y revient, il n'en pose
    // pas un second. C'est ce qui rend la boucle d'Adel litterale — le bouton
    // « Rechercher mon club » de l'assistant d'equipe (`TeamWizardName`) passe
    // par le MEME utilitaire, et le repose donc sur l'ecran ou il etait coince.
    expect(pileAccueil()).toEqual(['SearchHome', 'SearchHub']);
  });
});
