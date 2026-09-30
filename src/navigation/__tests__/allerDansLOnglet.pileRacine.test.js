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

import allerDansLOnglet from '@/navigation/allerDansLOnglet';
import { RouteNames } from '@/navigation/routeNames';
import { createFocusedTabResetListener } from '@/navigation/tabRootReset';

/**
 * RETOUR-ONGLET (a) — A22 de l'audit V1 (30/09) : « APRES LA SEANCE, JE SUIS BLOQUE ».
 *
 * 🔴 LE GESTE, photographie sur l'emulateur : programme d'entrainement, « Ma seance »,
 * on ouvre le parcours guide (un ecran de TACHE, monte sur la pile RACINE pour
 * cacher le dock), puis « Revenir a ma seance ». L'ecran revient bien… mais
 * « Accueil » ne ramene plus nulle part (avant = apres), et il faut QUATRE retours
 * pour revoir l'accueil.
 *
 * 🔎 LA CAUSE : `allerDansLOnglet` fait `navigate(HomeTab, …)` depuis la racine.
 * En React Navigation 7, `navigate` NE REVIENT PLUS en arriere vers une route
 * deja empilee (`@react-navigation/routers` StackRouter, cas 'NAVIGATE' : il ne
 * cherche l'existante que si `pop` est pose). Il EMPILE donc un SECOND `HomeTab`,
 * dont la pile d'accueil commence directement par l'ecran vise : sa racine n'est
 * plus l'accueil, et l'onglet « Accueil » deja au premier plan n'a rien a depiler.
 *
 * ⚠️ POURQUOI DE VRAIS ROUTEURS : ce n'est pas un appel manquant, c'est un ETAT.
 * Un espion sur `navigate` est vert des deux cotes du correctif (c'est exactement
 * ce que faisait `allerDansLOnglet.test.js` « la forme imbriquee »). Meme motif que
 * `retourAccueilDepuisRecherche.test.js` : les routeurs de la bibliotheque, des
 * vues minimales, et les NOMS de routes relus dans les vrais fichiers.
 */

const SOURCES = path.join(__dirname, '..', '..');
const PILE_ACCUEIL = path.join(__dirname, '..', 'private', 'stacks', 'SearchStack.js');

/**
 * Les routes declarees par un fichier de navigation.
 * @param {string} fichier le chemin du fichier
 * @returns {string[]} les noms de routes qu il monte, dans l'ordre
 */
const routesDe = (fichier) => [
  ...fs.readFileSync(fichier, 'utf8').matchAll(/name=\{RouteNames\.(\w+)\}/g),
].map((m) => m[1]);

// La VRAIE liste des ecrans de l'onglet d'accueil, relue dans SearchStack.js.
const ROUTES_ACCUEIL = routesDe(PILE_ACCUEIL);

/**
 * Tous les ecrans que `allerDansLOnglet` vise dans le depot, relus dans les sources :
 * un appelant ajoute demain est couvert sans que personne n'y pense.
 * @returns {string[]} les routes visees (sans doublon)
 */
const destinationsDesAppelants = () => {
  /** @type {Set<string>} */
  const cibles = new Set();
  /**
   * Descend dans un dossier et note chaque destination rencontree.
   * @param {string} dossier un dossier a parcourir
   * @returns {void}
   */
  const parcourir = (dossier) => {
    fs.readdirSync(dossier, { withFileTypes: true }).forEach((entree) => {
      const chemin = path.join(dossier, entree.name);
      if (entree.isDirectory()) {
        if (entree.name !== '__tests__') parcourir(chemin);
        return;
      }
      if (!entree.name.endsWith('.js')) return;
      const source = fs.readFileSync(chemin, 'utf8');
      // `\s*` : un appel ecrit sur plusieurs lignes (TrainingGuided:881) compte aussi.
      [...source.matchAll(/allerDansLOnglet\(\s*navigation,\s*RouteNames\.(\w+)/g)]
        .forEach((m) => cibles.add(m[1]));
    });
  };
  parcourir(path.join(SOURCES, 'views'));
  return [...cibles].sort();
};

/**
 * Une barre d'onglets minimale sur le VRAI `TabRouter`, dont le bouton se comporte
 * comme celui de la bibliotheque (BottomTabBar.tsx : onglet deja au premier plan
 * => aucune bascule, seul l'evenement `tabPress` part).
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
 * Une pile minimale sur le VRAI `StackRouter`.
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

/** @type {Record<string, any>} La navigation de chaque ecran, capturee au rendu. */
const mockNavigations = {};

/**
 * Un ecran temoin : il affiche son nom et capture sa navigation (la DERNIERE montee
 * gagne : c'est celle de l'ecran au-dessus).
 * @param {string} nom - Le nom de la route.
 * @returns {any} Le composant d'ecran.
 */
const Ecran = (nom) => function EcranTemoin({ navigation }) {
  mockNavigations[nom] = navigation;
  return createElement(Text, null, nom);
};

/**
 * L'onglet d'accueil : la pile de SearchStack.js, avec SES routes et SA racine.
 * @returns {any} La pile de l'onglet.
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
 * Les onglets, cables comme `PrivateTabNavigator` (l'ecouteur « Accueil » est le vrai).
 * @returns {any} Le navigateur d'onglets.
 */
function OngletsPrives() {
  return createElement(
    Onglets.Navigator,
    { id: undefined, initialRouteName: RouteNames.Search },
    createElement(Onglets.Screen, {
      component: PileAccueil,
      key: 'accueil',
      listeners: createFocusedTabResetListener,
      name: RouteNames.Search,
    }),
    createElement(Onglets.Screen, {
      component: Ecran(RouteNames.MyTeamList),
      key: 'equipes',
      listeners: createFocusedTabResetListener,
      name: RouteNames.MyTeamList,
    }),
  );
}

/** @type {any} */
let conteneur = null;
/** @type {any} */
let arbre = null;

/**
 * Monte l'application reduite : la racine (onglets + un ecran de TACHE), les onglets,
 * la pile d'accueil.
 * @returns {void}
 */
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
          component: Ecran(RouteNames.TrainingGuided), key: 'g', name: RouteNames.TrainingGuided,
        }),
      ),
    ));
  });
};

/**
 * Les noms des routes de la pile RACINE.
 * @returns {string[]} les routes empilees, dans l'ordre
 */
const pileRacine = () => conteneur.getRootState().routes.map((/** @type {any} */ r) => r.name);

/**
 * La pile de l'onglet d'accueil du DERNIER `HomeTab` empile (celui qu'on voit, ou
 * celui qui est juste sous l'ecran de tache).
 * @returns {string[]} les routes empilees, dans l'ordre
 */
const pileAccueil = () => {
  const onglets = conteneur.getRootState().routes
    .filter((/** @type {any} */ r) => r.name === RouteNames.HomeTab).pop()?.state;
  const accueil = onglets?.routes
    ?.find((/** @type {any} */ r) => r.name === RouteNames.Search)?.state;
  return accueil ? accueil.routes.map((/** @type {any} */ r) => r.name) : [RouteNames.SearchHome];
};

/**
 * Appuie sur un onglet de la barre VISIBLE (celle du dernier `HomeTab` monte).
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
 * Le chemin d'A22 : Accueil -> plan -> journee -> « Ma seance », puis le parcours
 * guide (ecran de TACHE, pile racine).
 * @returns {void}
 */
const allerJusquAuParcoursGuide = () => {
  act(() => { mockNavigations[RouteNames.SearchHome].navigate(RouteNames.TrainingPlan); });
  act(() => { mockNavigations[RouteNames.TrainingPlan].navigate(RouteNames.TrainingDay); });
  act(() => {
    mockNavigations[RouteNames.TrainingDay].navigate(RouteNames.TrainingSessionNow, {
      sessionId: 's-1',
    });
  });
  act(() => {
    mockNavigations[RouteNames.TrainingSessionNow].navigate(RouteNames.TrainingGuided);
  });
};

/**
 * « Revenir a ma seance », le vrai geste (TrainingGuided:851).
 * @returns {void}
 */
const revenirAMaSeance = () => {
  act(() => {
    allerDansLOnglet(mockNavigations[RouteNames.TrainingGuided], RouteNames.TrainingSessionNow, {
      sessionId: 's-1',
    });
  });
};

const SEANCE_RETROUVEE = [
  RouteNames.SearchHome,
  RouteNames.TrainingPlan,
  RouteNames.TrainingDay,
  RouteNames.TrainingSessionNow,
];

describe('RETOUR-ONGLET (a) — revenir dans l onglet depuis un ecran de tache', () => {
  beforeEach(() => {
    conteneur = null;
    Object.keys(mockNavigations).forEach((cle) => { delete mockNavigations[cle]; });
  });

  afterEach(() => {
    if (arbre) act(() => arbre.unmount());
    arbre = null;
  });

  it('les piles et les appelants sont bien lus (sinon ce filet ne mesure rien)', () => {
    expect(ROUTES_ACCUEIL[0]).toBe(RouteNames.SearchHome);
    expect(ROUTES_ACCUEIL).toEqual(expect.arrayContaining([
      RouteNames.TrainingSessionNow, RouteNames.TrainingDay, RouteNames.TrainingPlan,
    ]));
    expect(destinationsDesAppelants()).toEqual(expect.arrayContaining([
      RouteNames.SearchHome, RouteNames.TrainingSessionNow, RouteNames.TrainingVideoQueue,
    ]));
  });

  it('le chemin d A22 monte bien le parcours guide SUR la racine', () => {
    monter();
    allerJusquAuParcoursGuide();

    expect(pileRacine()).toEqual([RouteNames.HomeTab, RouteNames.TrainingGuided]);
    expect(pileAccueil()).toEqual(SEANCE_RETROUVEE);
  });

  it('« Revenir a ma seance » : UN SEUL HomeTab, et on retrouve SA seance', () => {
    monter();
    allerJusquAuParcoursGuide();

    revenirAMaSeance();

    expect(pileRacine()).toEqual([RouteNames.HomeTab]);
    expect(pileAccueil()).toEqual(SEANCE_RETROUVEE);
  });

  it('puis UN appui sur « Accueil » ramene a l accueil', () => {
    monter();
    allerJusquAuParcoursGuide();
    revenirAMaSeance();

    appuyerSurOnglet(RouteNames.Search);

    expect(pileRacine()).toEqual([RouteNames.HomeTab]);
    expect(pileAccueil()).toEqual([RouteNames.SearchHome]);
  });

  it('deux allers-retours n empilent AUCUNE copie (ni de HomeTab, ni de « Ma seance »)', () => {
    monter();
    allerJusquAuParcoursGuide();
    revenirAMaSeance();
    act(() => {
      mockNavigations[RouteNames.TrainingSessionNow].navigate(RouteNames.TrainingGuided);
    });
    revenirAMaSeance();

    expect(pileRacine()).toEqual([RouteNames.HomeTab]);
    expect(pileAccueil()).toEqual(SEANCE_RETROUVEE);
  });

  it.each(destinationsDesAppelants())(
    'destination %s : un seul HomeTab, et « Accueil » revient a l accueil',
    (destination) => {
      monter();
      allerJusquAuParcoursGuide();

      act(() => { allerDansLOnglet(mockNavigations[RouteNames.TrainingGuided], destination); });

      expect(pileRacine()).toEqual([RouteNames.HomeTab]);
      appuyerSurOnglet(RouteNames.Search);
      expect(pileAccueil()).toEqual([RouteNames.SearchHome]);
    },
  );
});
