import fs from 'fs';
import path from 'path';

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

import SearchHubLegacyRedirect from '@/views/search/SearchHubLegacyRedirect';
import { navigateToSearchHub } from '@/views/search/searchRouteHelpers';
import SearchRouteRedirect from '@/views/search/SearchRouteRedirect';

import { RouteNames } from '@/navigation/routeNames';
import { createFocusedTabResetListener } from '@/navigation/tabRootReset';

/**
 * RETOUR-ONGLET-2 — les navigations SŒURS du défaut A22 (audit V1, 30/09).
 *
 * 🔎 LE DÉFAUT, établi par RETOUR-ONGLET : en React Navigation 7, `StackRouter`
 * (cas 'NAVIGATE') ne cherche la route déjà empilée QUE si `pop` est posé. Depuis un
 * écran de la pile RACINE, `navigate(HomeTab, …)` EMPILE donc un second `HomeTab`
 * (et `replace(HomeTab, …)` aussi : il remplace l'écran du dessus, pas celui du
 * dessous). L'utilisateur se retrouve dans une copie de l'accueil ; l'original, et
 * l'écran qu'il croyait avoir quitté, attendent dessous.
 *
 * Quatre familles, relues une à une dans le code (carte R2 du lot) :
 *   F1  les écrans de REDIRECTION de la racine (SearchHubLegacyRedirect :25 :37,
 *       SearchRouteRedirect :31 :37) — `replace(HomeTab)` ;
 *   F2  `navigateToSearchHub`, appelé depuis la racine (SubscriptionSuccess,
 *       TeamWizardName) ;
 *   F3  un autre onglet, appelé EN DIRECT depuis la racine (SubscriptionSuccess
 *       :349 :358, EventWizardRecap :920, GuideOffersRecap :344) ;
 *   F4  les retours « de repli » (NotificationList, RequestsHub, MyLicenses,
 *       EventDetails) : ils ne naviguent vers `HomeTab` QUE si la racine n'a rien à
 *       dépiler — donc jamais au-dessus d'un `HomeTab`. Caractérisés ici, pas corrigés.
 *
 * ⚠️ POURQUOI DE VRAIS ROUTEURS : c'est un ÉTAT, pas un appel manquant. Même motif
 * que `allerDansLOnglet.pileRacine.test.js` : les routeurs de la bibliothèque, des
 * vues minimales, et les NOMS de routes relus dans les vrais fichiers. F1 et F2
 * montent le VRAI code (les deux écrans de redirection, le vrai `navigateToSearchHub`).
 */

jest.mock('@/theme/themeContext', () => ({
  __esModule: true,
  default: () => ({ Alignments: {}, Colors: {} }),
}));
jest.mock('@/components/templates/ScreenContainer', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: { documentId: 'moi' } }),
}));

const NAVIGATION = path.join(__dirname, '..');
const VUES = path.join(__dirname, '..', '..', 'views');

/**
 * Lit un fichier du dépôt.
 * @param {string} racine le dossier de départ
 * @param {...string} morceaux le chemin, morceau par morceau
 * @returns {string} son contenu
 */
const lire = (racine, ...morceaux) => fs.readFileSync(path.join(racine, ...morceaux), 'utf8');

/**
 * Les routes déclarées par un fichier de navigation, dans l'ordre.
 * @param {string} source le contenu du fichier
 * @returns {string[]} les noms de routes
 */
const routesDe = (source) => [...source.matchAll(/name=\{RouteNames\.(\w+)\}/g)].map((m) => m[1]);

const RACINE = lire(NAVIGATION, 'private', 'PrivateNavigator.js');
const ONGLETS = routesDe(lire(NAVIGATION, 'private', 'PrivateTabNavigator.js'));
const ROUTES_ACCUEIL = routesDe(lire(NAVIGATION, 'private', 'stacks', 'SearchStack.js'));
const ROUTES_EVENEMENT = routesDe(lire(NAVIGATION, 'private', 'stacks', 'EventStack.js'));
const ROUTES_EQUIPE = routesDe(lire(NAVIGATION, 'private', 'stacks', 'TeamStack.js'));

/**
 * Les noms sous lesquels la racine monte un écran de `views/search` (getComponent).
 * @param {string} module le nom du fichier, sans extension
 * @returns {string[]} les noms de routes
 */
const nomsMontesPar = (module) => [...RACINE.matchAll(new RegExp(
  `require\\('@/views/search/${module}'\\)\\.default\\}\\s*name=\\{RouteNames\\.(\\w+)\\}`,
  'g',
))].map((m) => m[1]);

const REDIRECTIONS_DE_TYPE = nomsMontesPar('SearchRouteRedirect');

// La branche `SearchRouteRedirect:31` ne s'atteint que si un 5ᵉ nom monte ce composant :
// le témoin la monte sous un nom qui n'est pas un type de recherche.
const ROUTE_SANS_TYPE = 'EcranDeRedirectionSansType';

// Les écrans de la RACINE d'où partent les navigations mesurées.
const ECRANS_DE_LA_RACINE = [
  RouteNames.GuideOffersRecap,
  RouteNames.MyLicenses,
  RouteNames.NotificationList,
  RouteNames.RequestsHub,
  RouteNames.SearchAlerts,
  RouteNames.SubscriptionSuccess,
];

/**
 * Une barre d'onglets minimale sur le VRAI `TabRouter`, dont le bouton se comporte
 * comme celui de la bibliothèque (BottomTabBar.tsx : onglet déjà au premier plan
 * => aucune bascule, seul l'événement `tabPress` part).
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
 * Une pile minimale sur le VRAI `StackRouter` (toutes ses routes restent montées).
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

const Onglets = createNavigatorFactory(BarreOnglets)();
const Pile = createNavigatorFactory(PileMinimale)();
const Racine = createNavigatorFactory(PileMinimale)();

/** @type {Record<string, any>} La navigation de chaque écran, capturée au rendu. */
const navigations = {};
/** @type {Record<string, any>} Un composant par nom, créé une fois. */
const composants = {};

/**
 * Un écran témoin : il affiche son nom et capture sa navigation.
 * @param {string} nom - Le nom de la route.
 * @returns {any} Le composant d'écran (le même à chaque appel).
 */
const Ecran = (nom) => {
  if (!composants[nom]) {
    composants[nom] = function EcranTemoin({ navigation }) {
      navigations[nom] = navigation;
      return createElement(Text, null, nom);
    };
  }
  return composants[nom];
};

/**
 * Une pile imbriquée, montée sous un nom de la racine (EventStack, TeamStack…).
 * @param {string[]} ecrans ses routes ; la première est sa racine
 * @returns {any} Le composant de pile.
 */
const pileImbriquee = (ecrans) => function PileImbriquee() {
  return createElement(
    Pile.Navigator,
    { id: undefined, initialRouteName: ecrans[0] },
    ...ecrans.map((nom) => createElement(Pile.Screen, {
      component: Ecran(nom), key: nom, name: nom,
    })),
  );
};

const PileAccueil = pileImbriquee(ROUTES_ACCUEIL);
const PileEvenement = pileImbriquee([RouteNames.EventDetails, RouteNames.EventWizardRecap]);
const PileEquipe = pileImbriquee([RouteNames.TeamWizardName]);

/**
 * Les onglets, câblés comme `PrivateTabNavigator` (l'écouteur « Accueil » est le vrai).
 * @returns {any} Le navigateur d'onglets.
 */
function OngletsPrives() {
  return createElement(
    Onglets.Navigator,
    { id: undefined, initialRouteName: RouteNames.Search },
    ...ONGLETS.map((nom) => createElement(Onglets.Screen, {
      component: nom === RouteNames.Search ? PileAccueil : Ecran(nom),
      key: nom,
      listeners: createFocusedTabResetListener,
      name: nom,
    })),
  );
}

/** @type {any} */
let conteneur = null;
/** @type {any} */
let arbre = null;

/**
 * Monte l'application réduite : la racine (onglets, League, redirections, écrans de
 * tâche, piles imbriquées), les onglets, la pile d'accueil.
 * @param {{ initialRouteName?: string, etatInitial?: any }} [options] le point de départ
 * @returns {void}
 */
const monter = ({ etatInitial, initialRouteName = RouteNames.HomeTab } = {}) => {
  act(() => {
    arbre = renderer.create(createElement(
      NavigationContainer,
      {
        initialState: etatInitial,
        ref: (/** @type {any} */ reference) => { if (reference) conteneur = reference; },
      },
      createElement(
        Racine.Navigator,
        { id: undefined, initialRouteName },
        createElement(Racine.Screen, {
          component: OngletsPrives, key: 'onglets', name: RouteNames.HomeTab,
        }),
        createElement(Racine.Screen, {
          component: Ecran(RouteNames.LeagueHomeTab), key: 'league', name: RouteNames.LeagueHomeTab,
        }),
        createElement(Racine.Screen, {
          component: SearchHubLegacyRedirect, key: 'hub', name: RouteNames.SearchHub,
        }),
        ...[...REDIRECTIONS_DE_TYPE, ROUTE_SANS_TYPE].map((nom) => createElement(Racine.Screen, {
          component: SearchRouteRedirect, key: nom, name: nom,
        })),
        ...ECRANS_DE_LA_RACINE.map((nom) => createElement(Racine.Screen, {
          component: Ecran(nom), key: nom, name: nom,
        })),
        createElement(Racine.Screen, {
          component: PileEvenement, key: 'evenement', name: RouteNames.EventStack,
        }),
        createElement(Racine.Screen, {
          component: PileEquipe, key: 'equipe', name: RouteNames.TeamStack,
        }),
      ),
    ));
  });
};

/**
 * Les noms des routes de la pile RACINE.
 * @returns {string[]} les routes empilées, dans l'ordre
 */
const pileRacine = () => conteneur.getRootState().routes.map((/** @type {any} */ r) => r.name);

/**
 * L'état des onglets du DERNIER `HomeTab` empilé (celui qu'on voit).
 * @returns {any} l'état du navigateur d'onglets
 */
const derniersOnglets = () => conteneur.getRootState().routes
  .filter((/** @type {any} */ r) => r.name === RouteNames.HomeTab).pop()?.state;

/**
 * L'onglet au premier plan du dernier `HomeTab`.
 * @returns {string | undefined} son nom
 */
const ongletVisible = () => {
  const onglets = derniersOnglets();
  return onglets?.routes?.[onglets.index]?.name;
};

/**
 * L'état de la pile d'accueil du dernier `HomeTab`.
 * @returns {any} l'état de la pile, ou undefined
 */
const etatAccueil = () => derniersOnglets()?.routes
  ?.find((/** @type {any} */ r) => r.name === RouteNames.Search)?.state;

/**
 * La pile de l'onglet d'accueil du dernier `HomeTab`.
 * @returns {string[]} les routes empilées, dans l'ordre
 */
const pileAccueil = () => {
  const accueil = etatAccueil();
  return accueil ? accueil.routes.map((/** @type {any} */ r) => r.name) : [RouteNames.SearchHome];
};

/**
 * Les paramètres de l'écran du dessus de la pile d'accueil.
 * @returns {any} ses paramètres
 */
const parametresEnHautDeLAccueil = () => {
  const accueil = etatAccueil();
  return accueil?.routes?.[accueil.index]?.params;
};

/**
 * Appuie sur un onglet de la barre VISIBLE (celle du dernier `HomeTab` monté).
 * @param {string} nom - Le nom de la route d'onglet.
 * @returns {void}
 */
const appuyerSurOnglet = (nom) => {
  const boutons = arbre.root.findAll(
    (/** @type {any} */ n) => n.props?.testID === `onglet-${nom}`
      && typeof n.props.onPress === 'function',
  );
  act(() => { boutons[boutons.length - 1].props.onPress(); });
};

/**
 * « Accueil » jusqu'à ce qu'il ne change plus rien (au plus 2 appuis : la bascule
 * sur l'onglet, puis le retour à sa racine).
 * @returns {void}
 */
const appuyerSurAccueilJusquAuBout = () => {
  appuyerSurOnglet(RouteNames.Search);
  appuyerSurOnglet(RouteNames.Search);
};

/**
 * Va, depuis l'accueil, sur un écran de la RACINE.
 * @param {string} nom la route de la racine
 * @param {any} [parametres] ses paramètres
 * @returns {void}
 */
const ouvrirDepuisLAccueil = (nom, parametres) => {
  act(() => { navigations[RouteNames.SearchHome].navigate(nom, parametres); });
};

/**
 * Le contrat du lot, vérifié au même endroit pour chaque famille : UN SEUL `HomeTab`,
 * rien au-dessus, et « Accueil » ramène à la racine de l'onglet.
 * @returns {void}
 */
const attendreUnSeulAccueilPuisSaRacine = () => {
  expect(pileRacine()).toEqual([RouteNames.HomeTab]);
  appuyerSurAccueilJusquAuBout();
  expect(pileRacine()).toEqual([RouteNames.HomeTab]);
  expect(ongletVisible()).toBe(RouteNames.Search);
  expect(pileAccueil()).toEqual([RouteNames.SearchHome]);
};

beforeEach(() => {
  conteneur = null;
  Object.keys(navigations).forEach((cle) => { delete navigations[cle]; });
});

afterEach(() => {
  if (arbre) act(() => arbre.unmount());
  arbre = null;
});

describe('RETOUR-ONGLET-2 — le témoin lit les VRAIS fichiers (sinon il ne mesure rien)', () => {
  it('les onglets, la pile d accueil et les piles imbriquées sont ceux de l app', () => {
    expect(ONGLETS[0]).toBe(RouteNames.Search);
    expect(ONGLETS).toEqual(expect.arrayContaining([
      RouteNames.MyEventList, RouteNames.MyTeamList,
    ]));
    expect(ROUTES_ACCUEIL[0]).toBe(RouteNames.SearchHome);
    expect(ROUTES_ACCUEIL).toContain(RouteNames.SearchHub);
    expect(ROUTES_EVENEMENT).toEqual(expect.arrayContaining([
      RouteNames.EventDetails, RouteNames.EventWizardRecap,
    ]));
    expect(ROUTES_EQUIPE).toContain(RouteNames.TeamWizardName);
  });

  it('la racine monte bien ces écrans, et les deux redirections sous ces noms-là', () => {
    expect(routesDe(RACINE)).toEqual(expect.arrayContaining([
      RouteNames.HomeTab, RouteNames.LeagueHomeTab, RouteNames.EventStack, RouteNames.TeamStack,
      ...ECRANS_DE_LA_RACINE,
    ]));
    expect(nomsMontesPar('SearchHubLegacyRedirect')).toEqual([RouteNames.SearchHub]);
    expect([...REDIRECTIONS_DE_TYPE].sort()).toEqual([
      RouteNames.SearchClubs,
      RouteNames.SearchEvents,
      RouteNames.SearchRecruitment,
      RouteNames.SearchReservations,
    ].sort());
  });
});

describe('F1 — les écrans de REDIRECTION de la racine', () => {
  it('SearchHubLegacyRedirect:25 — sans paramètre : la recherche dans L onglet', () => {
    monter();
    ouvrirDepuisLAccueil(RouteNames.SearchAlerts);

    act(() => { navigations[RouteNames.SearchAlerts].navigate(RouteNames.SearchHub); });

    expect(pileRacine()).toEqual([RouteNames.HomeTab]);
    expect(ongletVisible()).toBe(RouteNames.Search);
    expect(pileAccueil()).toEqual([RouteNames.SearchHome, RouteNames.SearchHub]);
    expect(parametresEnHautDeLAccueil()).toEqual({ activeType: 'events' });
    attendreUnSeulAccueilPuisSaRacine();
  });

  it('SearchHubLegacyRedirect:37 — avec d anciens paramètres : même onglet, type traduit', () => {
    monter();
    ouvrirDepuisLAccueil(RouteNames.SearchAlerts);

    act(() => {
      navigations[RouteNames.SearchAlerts].navigate(RouteNames.SearchHub, { activeType: 'clubs' });
    });

    expect(pileRacine()).toEqual([RouteNames.HomeTab]);
    expect(pileAccueil()).toEqual([RouteNames.SearchHome, RouteNames.SearchHub]);
    expect(parametresEnHautDeLAccueil()).toEqual({ activeType: 'clubs' });
    attendreUnSeulAccueilPuisSaRacine();
  });

  it.each([
    [RouteNames.SearchEvents, 'events'],
    [RouteNames.SearchClubs, 'clubs'],
    [RouteNames.SearchReservations, 'reservations'],
    [RouteNames.SearchRecruitment, 'recruitment'],
  ])('SearchRouteRedirect:37 — %s depuis les alertes (SearchAlerts:119)', (route, type) => {
    monter();
    ouvrirDepuisLAccueil(RouteNames.SearchAlerts);

    act(() => { navigations[RouteNames.SearchAlerts].navigate(route); });

    expect(pileRacine()).toEqual([RouteNames.HomeTab]);
    expect(pileAccueil()).toEqual([RouteNames.SearchHome, RouteNames.SearchHub]);
    expect(parametresEnHautDeLAccueil()).toEqual({ activeType: type });
    attendreUnSeulAccueilPuisSaRacine();
  });

  it('SearchRouteRedirect:31 — un nom sans type : retour à l accueil de L onglet', () => {
    monter();
    ouvrirDepuisLAccueil(RouteNames.SearchAlerts);

    act(() => { navigations[RouteNames.SearchAlerts].navigate(ROUTE_SANS_TYPE); });

    expect(pileRacine()).toEqual([RouteNames.HomeTab]);
    expect(ongletVisible()).toBe(RouteNames.Search);
    expect(pileAccueil()).toEqual([RouteNames.SearchHome]);
  });

  it('depuis un AUTRE onglet (Planning, EventListContent:833) : on bascule, sans copie', () => {
    monter();
    appuyerSurOnglet(RouteNames.MyEventList);

    act(() => { navigations[RouteNames.MyEventList].navigate(RouteNames.SearchEvents); });

    expect(pileRacine()).toEqual([RouteNames.HomeTab]);
    expect(ongletVisible()).toBe(RouteNames.Search);
    expect(pileAccueil()).toEqual([RouteNames.SearchHome, RouteNames.SearchHub]);
    attendreUnSeulAccueilPuisSaRacine();
  });

  it('🛡️ sans HomeTab dessous (mode League) : la redirection est REMPLACÉE', () => {
    // C'est ce cas qui interdit `navigate(…, { pop: true })` ici : faute de HomeTab à
    // retrouver, il EMPILERAIT par-dessus l'écran de redirection, et le retour
    // retomberait sur un écran qui tourne à vide (son effet ne se rejoue pas).
    monter({ initialRouteName: RouteNames.LeagueHomeTab });
    act(() => {
      navigations[RouteNames.LeagueHomeTab].navigate(RouteNames.SearchAlerts);
    });

    act(() => { navigations[RouteNames.SearchAlerts].navigate(RouteNames.SearchEvents); });

    expect(pileRacine()).toEqual([
      RouteNames.LeagueHomeTab, RouteNames.SearchAlerts, RouteNames.HomeTab,
    ]);
  });
});

describe('F2 — navigateToSearchHub appelé depuis la RACINE', () => {
  it('SubscriptionSuccess:367 « Publier une annonce » : un seul HomeTab', () => {
    monter();
    ouvrirDepuisLAccueil(RouteNames.SubscriptionSuccess);

    act(() => { navigateToSearchHub(navigations[RouteNames.SubscriptionSuccess], 'recruitment'); });

    expect(pileRacine()).toEqual([RouteNames.HomeTab]);
    expect(pileAccueil()).toEqual([RouteNames.SearchHome, RouteNames.SearchHub]);
    expect(parametresEnHautDeLAccueil()).toEqual({ activeType: 'recruitment' });
    attendreUnSeulAccueilPuisSaRacine();
  });

  it('TeamWizardName:239 « Rechercher mon club » (dans TeamStack) : un seul HomeTab', () => {
    monter();
    ouvrirDepuisLAccueil(RouteNames.TeamStack, { screen: RouteNames.TeamWizardName });
    expect(pileRacine()).toEqual([RouteNames.HomeTab, RouteNames.TeamStack]);

    act(() => { navigateToSearchHub(navigations[RouteNames.TeamWizardName], 'clubs'); });

    expect(pileRacine()).toEqual([RouteNames.HomeTab]);
    expect(pileAccueil()).toEqual([RouteNames.SearchHome, RouteNames.SearchHub]);
    expect(parametresEnHautDeLAccueil()).toEqual({ activeType: 'clubs' });
    attendreUnSeulAccueilPuisSaRacine();
  });
});

// F3 — la FORME d'appel. Les appels sont écrits en ligne dans des écrans lourds ; leur
// passage du rouge au vert est prouvé par les témoins de ces écrans (l'appel porte
// `{ pop: true }`). Ici, les vrais routeurs disent ce que chaque forme PRODUIT.
const APPELS_VERS_UN_AUTRE_ONGLET = [
  {
    appel: 'SubscriptionSuccess:349 « Publier un événement »',
    depart: () => ouvrirDepuisLAccueil(RouteNames.SubscriptionSuccess),
    ecran: RouteNames.SubscriptionSuccess,
    onglet: RouteNames.MyEventList,
    parametres: { screen: RouteNames.MyEventList },
  },
  {
    appel: 'SubscriptionSuccess:358 « Préparer ma compo »',
    depart: () => ouvrirDepuisLAccueil(RouteNames.SubscriptionSuccess),
    ecran: RouteNames.SubscriptionSuccess,
    onglet: RouteNames.MyTeamList,
    parametres: { screen: RouteNames.MyTeamList },
  },
  {
    appel: 'EventWizardRecap:920 (création sans identifiant)',
    depart: () => ouvrirDepuisLAccueil(RouteNames.EventStack, {
      screen: RouteNames.EventWizardRecap,
    }),
    ecran: RouteNames.EventWizardRecap,
    onglet: RouteNames.MyEventList,
    parametres: { screen: RouteNames.MyEventList },
  },
  {
    appel: 'GuideOffersRecap:344 « Plus tard »',
    depart: () => ouvrirDepuisLAccueil(RouteNames.GuideOffersRecap),
    ecran: RouteNames.GuideOffersRecap,
    onglet: RouteNames.Search,
    parametres: undefined,
  },
];

describe('F3 — un autre onglet, appelé en direct depuis la RACINE', () => {
  it.each(APPELS_VERS_UN_AUTRE_ONGLET)('$appel — SANS pop (avant) : un 2ᵉ HomeTab', ({
    depart, ecran, parametres,
  }) => {
    monter();
    depart();
    const avant = pileRacine();

    act(() => { navigations[ecran].navigate(RouteNames.HomeTab, parametres); });

    expect(pileRacine()).toEqual([...avant, RouteNames.HomeTab]);
  });

  it.each(APPELS_VERS_UN_AUTRE_ONGLET)('$appel — AVEC pop : un seul HomeTab', ({
    depart, ecran, onglet, parametres,
  }) => {
    monter();
    depart();

    act(() => { navigations[ecran].navigate(RouteNames.HomeTab, parametres, { pop: true }); });

    expect(pileRacine()).toEqual([RouteNames.HomeTab]);
    expect(ongletVisible()).toBe(onglet);
    attendreUnSeulAccueilPuisSaRacine();
  });
});

// F4 — les retours « de repli ». Le gestionnaire est REJOUÉ tel qu'il est écrit ; le
// premier test relit les vrais fichiers pour que ce rejeu ne mente pas le jour où
// l'un d'eux change de forme.
const REPLIS = [
  {
    appel: 'NotificationList:493',
    fichier: ['notification', 'NotificationList.js'],
    forme: /if \(nav\.canGoBack\(\)\) \{\s*nav\.goBack\(\);\s*return;\s*\}\s*nav\.navigate\(RouteNames\.HomeTab\);/,
    route: RouteNames.NotificationList,
  },
  {
    appel: 'RequestsHub:741',
    fichier: ['requests', 'RequestsHub.js'],
    forme: /if \(canGoBack\) \{\s*navigation\.goBack\(\);\s*return;\s*\}\s*navigation\.navigate\(RouteNames\.HomeTab\);/,
    route: RouteNames.RequestsHub,
  },
  {
    appel: 'MyLicenses:293',
    fichier: ['license', 'MyLicenses.js'],
    forme: /if \(navigation\.canGoBack\?\.\(\)\) navigation\.goBack\(\);\s*else navigation\.navigate\(RouteNames\.HomeTab\);/,
    route: RouteNames.MyLicenses,
  },
];

/**
 * Le repli écrit dans NotificationList, RequestsHub et MyLicenses.
 * @param {any} navigation la navigation de l'écran
 * @returns {void}
 */
const retourDeRepli = (navigation) => {
  if (navigation.canGoBack()) {
    navigation.goBack();
    return;
  }
  navigation.navigate(RouteNames.HomeTab);
};

/**
 * Le repli écrit dans EventDetails (`handleBackAfterCreation`).
 * @param {any} navigation la navigation de l'écran
 * @returns {void}
 */
const retourApresCreation = (navigation) => {
  const parentNavigation = navigation.getParent();
  if (parentNavigation?.canGoBack?.()) {
    parentNavigation.goBack();
    return;
  }
  navigation.navigate(RouteNames.HomeTab, { screen: RouteNames.MyEventList });
};

describe('F4 — les retours de repli : ils ne courent que si la racine n a RIEN à dépiler', () => {
  it('les quatre fichiers ont toujours cette forme (sinon ce rejeu ment)', () => {
    REPLIS.forEach(({ fichier, forme }) => {
      expect(lire(VUES, ...fichier)).toMatch(forme);
    });
    expect(lire(VUES, 'event', 'EventDetails.js')).toMatch(
      /const parentNavigation = navigation\.getParent\(\);\s*if \(parentNavigation\?\.canGoBack\?\.\(\)\) \{\s*parentNavigation\.goBack\(\);\s*return;\s*\}\s*navigation\.navigate\(RouteNames\.HomeTab, \{ screen: RouteNames\.MyEventList \}\);/,
    );
  });

  it.each(REPLIS)('$appel — au-dessus de l accueil : on DÉPILE, jamais de copie', ({ route }) => {
    monter({ etatInitial: { routes: [{ name: RouteNames.HomeTab }, { name: route }] } });

    act(() => { retourDeRepli(navigations[route]); });

    attendreUnSeulAccueilPuisSaRacine();
  });

  it.each(REPLIS)('$appel — seul à la racine (lien, notification) : UN HomeTab', ({ route }) => {
    monter({ etatInitial: { routes: [{ name: route }] } });

    act(() => { retourDeRepli(navigations[route]); });

    expect(pileRacine()).toEqual([route, RouteNames.HomeTab]);
    appuyerSurAccueilJusquAuBout();
    expect(pileAccueil()).toEqual([RouteNames.SearchHome]);
  });

  it('EventDetails:3218 — au-dessus de l accueil : on dépile la pile événement', () => {
    monter();
    ouvrirDepuisLAccueil(RouteNames.EventStack, { screen: RouteNames.EventDetails });

    act(() => { retourApresCreation(navigations[RouteNames.EventDetails]); });

    attendreUnSeulAccueilPuisSaRacine();
  });

  it('EventDetails:3218 — seul à la racine (lien d événement) : UN HomeTab', () => {
    monter({
      etatInitial: {
        routes: [{
          name: RouteNames.EventStack,
          state: { routes: [{ name: RouteNames.EventDetails }] },
        }],
      },
    });

    act(() => { retourApresCreation(navigations[RouteNames.EventDetails]); });

    expect(pileRacine()).toEqual([RouteNames.EventStack, RouteNames.HomeTab]);
    expect(ongletVisible()).toBe(RouteNames.MyEventList);
  });
});
