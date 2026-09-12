import fs from 'fs';
import path from 'path';

import {
  createNavigatorFactory,
  NavigationContainer,
  useNavigationBuilder,
} from '@react-navigation/native';
import { StackRouter } from '@react-navigation/routers';
import { createElement } from 'react';
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import EventDetails from '@/views/event/EventDetails';
import ReservationDetails from '@/views/reservation/ReservationDetails';

import { navigateToStackScreenOrScreen } from '@/navigation/navigationAvailability';
import { RouteNames } from '@/navigation/routeNames';

import { navigateToSearchMapDetail } from '@/platform/maps/searchMapDetailNavigation';

/*
 * NAVMORTE2 -- MECANISME 2 : LES BOUTONS D EVENTDETAILS SONT MORTS QUAND LA FICHE
 * EST OUVERTE COMME UNE RESERVATION.
 *
 * LE CHEMIN. `ReservationDetails` est monte sur la pile RACINE
 * (navigation/private/PrivateNavigator.js:335) et rend `EventDetails` en lui passant
 * SA navigation, celle de la racine (views/reservation/ReservationDetails.js:15-16).
 * On y arrive par la carte reservation de la liste des evenements
 * (views/event/ParticipantEventList.js:651) et par la carte de recherche
 * (platform/maps/searchMapDetailNavigation.js:59-62, SearchMapScreen est sur la racine).
 *
 * LE PIEGE. L appel, la composition et la convocation ne vivent que dans `EventStack`
 * (navigation/private/stacks/EventStack.js). Un `navigate('EventAttendanceCall')`
 * parti de la racine est essaye par la racine, puis par ses PARENTS ; les navigateurs
 * ENFANTS ne sont essayes que si l action porte une cible ou si
 * `navigationInChildEnabled` est allume (@react-navigation/core 7.12.4,
 * src/useOnAction.tsx:127-149). L app ne l allume pas (defaut `false`,
 * @react-navigation/native src/NavigationContainer.tsx:91). L action n est traitee par
 * personne, et en production c est SILENCIEUX (BaseNavigationContainer.tsx:403) :
 * le bouton ne fait RIEN.
 *
 * POURQUOI DE VRAIS ROUTEURS. Un espion sur `navigate` est vert des deux cotes du
 * correctif : l appel part bien, c est le ROUTEUR qui le perd. Meme motif que
 * friendlyMatchWizardAtterrissage.test.js (vrai StackRouter, vrai bouillonnement, zero
 * dependance native) ; l arbre est LU dans les fichiers de navigation, comme
 * allerDansLOnglet.test.js.
 *
 * REEL : `ReservationDetails`, les routeurs, `navigateToSearchMapDetail`,
 * `navigateToStackScreenOrScreen`, les routes de PrivateNavigator.js,
 * PrivateTabNavigator.js et stacks/*.js.
 * REJOUE : les appels de navigation des cinq fonctions visees, LUS dans le code
 * (forme directe, forme imbriquee `navigate(Pile, { screen })`, ou
 * `navigateToStackScreenOrScreen`), et l appel de la carte de ParticipantEventList.
 * `EventDetails` (9 765 lignes) est remplace par une SONDE qui retient les deux
 * navigations qu il recoit : ses props, et le contexte que lit EventParticipants
 * (`useNavigation`). Le temoin passe donc au vert quel que soit le correctif retenu :
 * ReservationDetails qui renvoie vers EventStack, ou chaque appel imbrique.
 *
 * LE CONTROLE. Les MEMES rejeux, depuis `EventStack > EventDetails` (un evenement
 * ordinaire), menent tous a leur ecran. Si le controle rougit, c est le harnais qui
 * ment, pas l app.
 *
 * CE QUE CE FICHIER NE PROUVE PAS : que ces boutons sont AFFICHES sur une reservation
 * (gardes `canEdit`, equipe, fenetre d appel). Il prouve qu une fois appuyes, ils ne
 * menent nulle part.
 */

/**
 * Les fiches `EventDetails` montees, par cle de route.
 * @type {Map<string, { contexte: any, navigation: any, route: any }>}
 */
const mockFiches = new Map();

jest.mock('@/views/event/EventDetails', () => {
  const { useNavigation } = jest.requireActual('@react-navigation/native');
  const React = jest.requireActual('react');
  const ReactNative = jest.requireActual('react-native');
  return {
    __esModule: true,
    /**
     * La sonde : elle retient ce que la fiche aurait recu, et rien d autre.
     * @param {any} props les props passees a la fiche
     * @returns {any} un texte temoin
     */
    default: function SondeEventDetails(props) {
      const contexte = useNavigation();
      mockFiches.set(props.route?.key, {
        contexte,
        navigation: props.navigation,
        route: props.route,
      });
      return React.createElement(ReactNative.Text, null, 'EventDetails');
    },
  };
});

const SOURCES = path.join(__dirname, '..', '..', '..');

/**
 * Lit un fichier du dossier src/.
 * @param {string} relatif le chemin depuis src/
 * @returns {string} son contenu
 */
const lire = (relatif) => fs.readFileSync(path.join(SOURCES, relatif), 'utf8');

/**
 * Les routes montees par un fichier de navigation.
 * @param {string} source le code du fichier
 * @returns {string[]} les noms de routes, sans doublon
 */
const routesDe = (source) => [...new Set(
  [...source.matchAll(/name=\{RouteNames\.(\w+)\}/g)]
    .map((trouve) => RouteNames[trouve[1]])
    .filter(Boolean),
)];

const RACINE = routesDe(lire('navigation/private/PrivateNavigator.js'));
const ONGLETS = routesDe(lire('navigation/private/PrivateTabNavigator.js'));

/** @type {Map<string, { initiale: string, routes: string[] }>} */
const PILES = new Map(fs.readdirSync(path.join(SOURCES, 'navigation', 'private', 'stacks'))
  .filter((nom) => nom.endsWith('.js'))
  .map((nom) => {
    const source = lire(`navigation/private/stacks/${nom}`);
    const routes = routesDe(source);
    const initiale = RouteNames[source.match(/initialRouteName=\{RouteNames\.(\w+)\}/)?.[1]];
    const cle = nom.replace(/\.js$/, '');
    return [RouteNames[cle] || cle, {
      initiale: routes.includes(initiale) ? initiale : routes[0],
      routes,
    }];
  }));

/**
 * Une pile minimale batie sur le VRAI `StackRouter`. Elle rend tous ses ecrans.
 * @param {any} props les props du navigateur
 * @returns {any} le contenu de navigation
 */
function PileMinimale(props) {
  const { descriptors, NavigationContent, state } = useNavigationBuilder(StackRouter, props);
  return createElement(
    NavigationContent,
    null,
    state.routes.map((/** @type {any} */ route) => descriptors[route.key].render()),
  );
}

const creerPile = createNavigatorFactory(PileMinimale);
const Racine = creerPile();
const Pile = creerPile();

/** @type {Map<string, any>} la navigation vue par chaque ecran temoin */
const navigationsDesEcrans = new Map();
/** @type {Map<string, any>} */
const ecransTemoins = new Map();

/**
 * Un ecran temoin : il affiche son nom et retient sa navigation.
 * @param {string} nom le nom de la route
 * @returns {any} le composant d ecran (le meme a chaque appel)
 */
const ecranTemoin = (nom) => {
  if (ecransTemoins.has(nom)) return ecransTemoins.get(nom);
  /**
   * L ecran temoin de cette route.
   * @param {any} props les props d ecran
   * @returns {any} son nom, en texte
   */
  function EcranTemoin({ navigation }) {
    navigationsDesEcrans.set(nom, navigation);
    return createElement(Text, null, nom);
  }
  ecransTemoins.set(nom, EcranTemoin);
  return EcranTemoin;
};

/**
 * Une pile imbriquee, avec les routes lues dans son fichier. `EventDetails` y est la
 * sonde ; tout le reste est un ecran temoin.
 * @param {string[]} routes les routes de la pile
 * @param {string} initiale sa route initiale
 * @returns {any} le composant de la pile
 */
const pileLue = (routes, initiale) => function PileLue() {
  return createElement(
    Pile.Navigator,
    { id: undefined, initialRouteName: initiale },
    ...routes.map((nom) => createElement(Pile.Screen, {
      component: nom === RouteNames.EventDetails ? EventDetails : ecranTemoin(nom),
      key: nom,
      name: nom,
    })),
  );
};

/**
 * Le composant d une route de la racine : le VRAI ReservationDetails, une pile lue, ou
 * un ecran temoin. L onglet d accueil est reduit a une pile (on ne mesure que la
 * remontee, que les onglets ne changent pas) qui s ouvre sur la liste des evenements.
 * @param {string} nom le nom de la route
 * @returns {any} le composant
 */
const composantDeLaRacine = (nom) => {
  if (nom === RouteNames.ReservationDetails) return ReservationDetails;
  if (nom === RouteNames.HomeTab) return pileLue(ONGLETS, RouteNames.MyEventList);
  const pile = PILES.get(nom);
  return pile ? pileLue(pile.routes, pile.initiale) : ecranTemoin(nom);
};

const ECRANS_DE_LA_RACINE = RACINE.map((nom) => ({ composant: composantDeLaRacine(nom), nom }));

/**
 * L application reduite : la racine lue dans PrivateNavigator.js.
 * @returns {any} le navigateur racine
 */
function Application() {
  return createElement(
    Racine.Navigator,
    { id: undefined, initialRouteName: RouteNames.HomeTab },
    ...ECRANS_DE_LA_RACINE.map(({ composant, nom }) => createElement(Racine.Screen, {
      component: composant,
      key: nom,
      name: nom,
    })),
  );
}

/** @type {any[]} les actions qu AUCUN navigateur n a traitees */
let nonTraitees = [];
/** @type {any} */
let conteneur = null;
/** @type {any} */
let arbre = null;

const demonter = () => {
  if (arbre) act(() => arbre.unmount());
  arbre = null;
};

const monter = () => {
  demonter();
  nonTraitees = [];
  mockFiches.clear();
  navigationsDesEcrans.clear();
  act(() => {
    arbre = renderer.create(createElement(
      NavigationContainer,
      {
        onUnhandledAction: (/** @type {any} */ action) => { nonTraitees.push(action); },
        ref: (/** @type {any} */ reference) => { if (reference) conteneur = reference; },
      },
      createElement(Application),
    ));
  });
};

afterEach(demonter);

/**
 * La route au premier plan, en descendant jusqu a la feuille.
 * @returns {any} la route affichee
 */
const routeAuPremierPlan = () => {
  /** @type {any} */
  let route = null;
  let etat = conteneur.getRootState();
  while (etat) {
    route = etat.routes[etat.index ?? etat.routes.length - 1];
    etat = route.state;
  }
  return route;
};

/**
 * La fiche au premier plan, si c en est une.
 * @returns {{ contexte: any, navigation: any, route: any } | undefined} la sonde
 */
const ficheAuPremierPlan = () => mockFiches.get(routeAuPremierPlan()?.key);

// ---------------------------------------------------------------------------
// LECTURE DES APPELS DANS LE CODE
// ---------------------------------------------------------------------------

/**
 * Remplace les commentaires par des espaces, sauts de ligne gardes : les positions,
 * donc les numeros de ligne, restent justes. Les chaines sont laissees intactes.
 * @param {string} code un morceau de code qui commence hors chaine et hors commentaire
 * @returns {string} le meme code, de la meme longueur, sans commentaires
 */
const sansCommentaires = (code) => {
  let sortie = '';
  let i = 0;
  while (i < code.length) {
    const deux = code.slice(i, i + 2);
    if (deux === '//') {
      const fin = code.indexOf('\n', i);
      const bout = fin === -1 ? code.length : fin;
      sortie += ' '.repeat(bout - i);
      i = bout;
    } else if (deux === '/*') {
      const fin = code.indexOf('*/', i + 2);
      const bout = fin === -1 ? code.length : fin + 2;
      sortie += code.slice(i, bout).replace(/[^\n]/g, ' ');
      i = bout;
    } else if (['\'', '"', '`'].includes(code[i])) {
      let j = i + 1;
      while (j < code.length && code[j] !== code[i]) j += code[j] === '\\' ? 2 : 1;
      sortie += code.slice(i, j + 1);
      i = j + 1;
    } else {
      sortie += code[i];
      i += 1;
    }
  }
  return sortie;
};

/**
 * Decoupe ce qui suit une parenthese ou une accolade ouvrante en elements de
 * premier niveau (arguments d un appel, ou entrees d un objet).
 * @param {string} code du code sans commentaires
 * @param {number} ouverture la position de `(` ou `{`
 * @returns {string[]} les elements, sans les vides
 */
const elementsDePremierNiveau = (code, ouverture) => {
  const elements = [];
  let profondeur = 0;
  let debut = ouverture + 1;
  let i = ouverture;
  while (i < code.length) {
    const car = code[i];
    if (['\'', '"', '`'].includes(car)) {
      let j = i + 1;
      while (j < code.length && code[j] !== car) j += code[j] === '\\' ? 2 : 1;
      i = j;
    } else if ('({['.includes(car)) {
      profondeur += 1;
    } else if (')}]'.includes(car)) {
      profondeur -= 1;
      if (profondeur === 0) {
        elements.push(code.slice(debut, i).trim());
        return elements.filter(Boolean);
      }
    } else if (car === ',' && profondeur === 1) {
      elements.push(code.slice(debut, i).trim());
      debut = i + 1;
    }
    i += 1;
  }
  return elements.filter(Boolean);
};

/**
 * La valeur d une cle de premier niveau dans un objet litteral ecrit dans le code.
 * @param {string | undefined} objet le texte de l objet, `{ ... }`
 * @param {string} cle la cle cherchee
 * @returns {string | null} le texte de la valeur, ou null
 */
const valeurDeCle = (objet, cle) => {
  if (!objet || !objet.startsWith('{')) return null;
  const motif = new RegExp(`^${cle}\\s*:\\s*`);
  const entree = elementsDePremierNiveau(objet, 0).find((texte) => motif.test(texte));
  return entree ? entree.replace(motif, '') : null;
};

/**
 * Les routes que designe une expression : `RouteNames.X`, ou une variable connue.
 * @param {string | null | undefined} expression le texte de l expression
 * @param {Record<string, string[]>} variables les variables de route du bloc
 * @returns {string[] | null} les routes, ou null si l expression est illisible
 */
const routesDeLExpression = (expression, variables) => {
  const nommee = expression?.match(/^RouteNames\.(\w+)$/);
  if (nommee) return RouteNames[nommee[1]] ? [RouteNames[nommee[1]]] : null;
  return (expression && variables[expression]) || null;
};

const APPEL = /\b(navigateToStackScreenOrScreen)\s*\(|\b(navigation\w*)\.(navigate|push|replace)\s*\(/g;

/**
 * Les appels de navigation d un morceau de code, avec leur forme et leur ligne.
 * @param {object} parametres ce qu il faut pour lire
 * @param {number} parametres.debut la position du morceau dans le fichier
 * @param {string} parametres.fichier le chemin depuis src/, pour le message
 * @param {number} parametres.fin la position de fin du morceau
 * @param {string} parametres.source le fichier entier
 * @param {Record<string, string[]>} [parametres.variables] les variables de route
 * @returns {any[]} les appels lus
 */
const appelsDuMorceau = ({
  debut, fichier, fin, source, variables = {},
}) => {
  const code = sansCommentaires(source.slice(debut, fin));
  return [...code.matchAll(APPEL)].map((trouve) => {
    const position = trouve.index || 0;
    const args = elementsDePremierNiveau(code, position + trouve[0].length - 1);
    const ligne = source.slice(0, debut + position).split('\n').length;
    const ou = `${fichier.split('/').pop()}:${ligne}`;
    if (trouve[1]) {
      const pile = routesDeLExpression(valeurDeCle(args[1], 'stack'), {});
      const ecrans = routesDeLExpression(valeurDeCle(args[1], 'screen'), variables);
      return pile && ecrans
        ? {
          forme: 'aide', ou, pile: pile[0], routes: ecrans,
        }
        : { forme: 'inconnue', ou, texte: trouve[0] };
    }
    const premier = routesDeLExpression(args[0], variables);
    const imbriques = routesDeLExpression(valeurDeCle(args[1], 'screen'), variables);
    if (premier && imbriques) {
      return {
        forme: 'imbriquee', methode: trouve[3], ou, pile: premier[0], routes: imbriques,
      };
    }
    if (premier) {
      return {
        forme: 'directe', methode: trouve[3], ou, routes: premier,
      };
    }
    return { forme: 'inconnue', ou, texte: `${trouve[0]}${args[0] || ''}` };
  });
};

/**
 * Rejoue un appel lu, avec une navigation reelle.
 * @param {any} appel l appel lu
 * @param {string} route la route visee
 * @param {any} navigation la navigation sur laquelle l appel part
 * @param {Record<string, any>} params les parametres transmis
 * @returns {void}
 */
const rejouer = (appel, route, navigation, params) => {
  if (appel.forme === 'aide') {
    navigateToStackScreenOrScreen(navigation, { params, screen: route, stack: appel.pile });
  } else if (appel.forme === 'imbriquee') {
    navigation[appel.methode](appel.pile, { params, screen: route });
  } else {
    navigation[appel.methode](route, params);
  }
};

// ---------------------------------------------------------------------------
// LES GESTES CONFIRMES
// ---------------------------------------------------------------------------

/*
 * Les autres branches d EventDetails (tournoi, detection, stage, stats de match) sont
 * ECARTEES : gardees par le type d evenement, jamais une reservation. C est aussi
 * pourquoi `DetectionSquadSetup` n est pas une destination de `compositionRoute` ici.
 */
const GESTES = [
  {
    fichier: 'views/event/EventDetails.js',
    fonction: 'openAttendanceCall',
    navigation: 'props',
    routes: [RouteNames.EventAttendanceCall],
  },
  {
    fichier: 'views/event/components/EventParticipants.js',
    fonction: 'ouvrirLAppel',
    navigation: 'contexte',
    routes: [RouteNames.EventAttendanceCall],
  },
  {
    fichier: 'views/event/EventDetails.js',
    fonction: 'openCompositionBoard',
    navigation: 'props',
    routes: [RouteNames.MatchCallUpSelection, RouteNames.TacticalBoardV2],
    variables: {
      compositionRoute: [RouteNames.MatchCallUpSelection, RouteNames.TacticalBoardV2],
    },
  },
  {
    fichier: 'views/event/EventDetails.js',
    fonction: 'openPublishedConvocation',
    navigation: 'props',
    routes: [
      RouteNames.PlayerConvocation,
      RouteNames.MatchCompositionBoard,
      RouteNames.MatchConvocationPublished,
    ],
  },
  {
    fichier: 'views/event/EventDetails.js',
    fonction: 'openCompositionEdit',
    navigation: 'props',
    routes: [RouteNames.MatchCallUpSelection],
  },
];

const LECTURES = GESTES.map((geste) => {
  const source = lire(geste.fichier);
  const debut = source.indexOf(`const ${geste.fonction} = useCallback(`);
  const fin = debut === -1 ? -1 : source.indexOf('\n  }, [', debut);
  const appels = fin === -1 ? [] : appelsDuMorceau({
    debut, fichier: geste.fichier, fin, source, variables: geste.variables,
  });
  return { appels, geste, trouve: fin !== -1 };
});

const REJEUX = LECTURES.flatMap(({ appels, geste }) => appels
  .filter((appel) => appel.forme !== 'inconnue')
  .flatMap((appel) => appel.routes
    .filter((/** @type {string} */ route) => geste.routes.includes(route))
    .map((/** @type {string} */ route) => ({ appel, geste, route }))));

const PARAMS_DU_GESTE = { eventId: 'evenement-1', teamId: 'equipe-1' };

/**
 * Pour chaque geste : on remonte l app, on ouvre la fiche par l entree donnee, on
 * rejoue l appel, et on regarde si un navigateur l a traite ET ou l on est arrive.
 * @param {() => void} ouvrirLaFiche l entree
 * @returns {string[]} les gestes morts, un par ligne lisible
 */
const gestesMorts = (ouvrirLaFiche) => REJEUX.flatMap(({ appel, geste, route }) => {
  monter();
  ouvrirLaFiche();
  const fiche = ficheAuPremierPlan();
  const nom = `${appel.ou} ${geste.fonction} -> ${route}`;
  if (!fiche) return [`${nom} : la fiche n est pas au premier plan (entree cassee)`];
  const navigation = geste.navigation === 'contexte' ? fiche.contexte : fiche.navigation;
  const avant = nonTraitees.length;
  act(() => { rejouer(appel, route, navigation, PARAMS_DU_GESTE); });
  const perdue = nonTraitees[avant];
  const arrivee = routeAuPremierPlan()?.name;
  if (!perdue && arrivee === route) return [];
  return [perdue
    ? `${nom} : action ${perdue.type} traitee par AUCUN navigateur, l ecran reste ${arrivee}`
    : `${nom} : traitee, mais on arrive sur ${arrivee}`];
});

// ---------------------------------------------------------------------------
// LES ENTREES
// ---------------------------------------------------------------------------

const ID_RESERVATION = 'reservation-1';

// La carte reservation de ParticipantEventList : l appel est LU dans le code, entre la
// prop `item={item.reservation}` et la fin de la balise.
const LISTE = 'views/event/ParticipantEventList.js';
const SOURCE_LISTE = lire(LISTE);
const DEBUT_CARTE = SOURCE_LISTE.indexOf('item={item.reservation}');
const FIN_CARTE = DEBUT_CARTE === -1
  ? -1
  : sansCommentaires(SOURCE_LISTE.slice(DEBUT_CARTE, DEBUT_CARTE + 4000)).indexOf('/>');
const APPELS_CARTE = FIN_CARTE === -1 ? [] : appelsDuMorceau({
  debut: DEBUT_CARTE, fichier: LISTE, fin: DEBUT_CARTE + FIN_CARTE, source: SOURCE_LISTE,
});

const ouvrirDepuisLaListe = () => {
  const [appel] = APPELS_CARTE;
  act(() => {
    rejouer(appel, appel.routes[0], navigationsDesEcrans.get(RouteNames.MyEventList), {
      eventId: ID_RESERVATION,
      reservationId: ID_RESERVATION,
    });
  });
};

const ouvrirDepuisLaCarte = () => {
  act(() => { conteneur.navigate(RouteNames.SearchMapScreen, { scope: 'reservations' }); });
  act(() => {
    navigateToSearchMapDetail({
      isAuthenticated: true,
      navigation: navigationsDesEcrans.get(RouteNames.SearchMapScreen),
      rawItem: { documentId: ID_RESERVATION },
      scope: 'reservations',
    });
  });
};

const ouvrirUnEvenementOrdinaire = () => {
  act(() => {
    conteneur.navigate(RouteNames.EventStack, {
      params: { eventId: 'evenement-1' },
      screen: RouteNames.EventDetails,
    });
  });
};

// ---------------------------------------------------------------------------
// LES TEMOINS
// ---------------------------------------------------------------------------

describe('NAVMORTE2 mecanisme 2 -- le harnais lit le vrai arbre et les vrais gestes', () => {
  it('les routes sont lues dans les fichiers de navigation (sinon rien n est mesure)', () => {
    expect(RACINE.length).toBeGreaterThan(20);
    expect(RACINE).toEqual(expect.arrayContaining([
      RouteNames.HomeTab,
      RouteNames.EventStack,
      RouteNames.ReservationDetails,
      RouteNames.SearchMapScreen,
    ]));
    expect(ONGLETS).toContain(RouteNames.MyEventList);
    expect(PILES.get(RouteNames.EventStack)?.initiale).toBe(RouteNames.EventDetails);
    expect(PILES.get(RouteNames.EventStack)?.routes).toEqual(expect.arrayContaining([
      RouteNames.EventAttendanceCall,
      RouteNames.MatchCallUpSelection,
      RouteNames.MatchCompositionBoard,
      RouteNames.MatchConvocationPublished,
      RouteNames.PlayerConvocation,
      RouteNames.TacticalBoardV2,
    ]));
  });

  it('chaque geste confirme est retrouve, sous une forme que le temoin sait rejouer', () => {
    const illisibles = LECTURES.flatMap(({ appels, geste, trouve }) => [
      ...(trouve ? [] : [`${geste.fichier} : fonction ${geste.fonction} introuvable`]),
      ...appels
        .filter((appel) => appel.forme === 'inconnue')
        .map((appel) => `${appel.ou} ${geste.fonction} : forme non rejouable (${appel.texte})`),
      ...geste.routes
        .filter((route) => !REJEUX
          .some((rejeu) => rejeu.geste === geste && rejeu.route === route))
        .map((route) => `${geste.fichier} ${geste.fonction} -> ${route} : aucun appel lu`),
    ]);

    expect(illisibles).toEqual([]);
    expect(REJEUX).toHaveLength(8);
  });

  it('la carte reservation de la liste porte UN appel de navigation lisible', () => {
    expect(DEBUT_CARTE).toBeGreaterThan(-1);
    expect(APPELS_CARTE).toHaveLength(1);
    expect(APPELS_CARTE[0].forme).not.toBe('inconnue');
  });
});

describe('CONTROLE -- depuis EventStack > EventDetails, les memes gestes aboutissent', () => {
  it('la fiche d un evenement ordinaire est au premier plan', () => {
    monter();
    ouvrirUnEvenementOrdinaire();

    expect(routeAuPremierPlan()?.name).toBe(RouteNames.EventDetails);
    expect(ficheAuPremierPlan()).toBeDefined();
    expect(nonTraitees).toEqual([]);
  });

  it('aucun geste mort', () => {
    expect(gestesMorts(ouvrirUnEvenementOrdinaire)).toEqual([]);
  });
});

const ENTREES = [
  [
    'la carte reservation de la liste (ParticipantEventList.js:651)',
    ouvrirDepuisLaListe,
  ],
  [
    'le point reservation de la carte (searchMapDetailNavigation.js:59-62)',
    ouvrirDepuisLaCarte,
  ],
];

describe.each(ENTREES)('RESERVATION ouverte par %s', (_entree, ouvrirLaFiche) => {
  it('la fiche de la reservation est au premier plan, avec son identifiant', () => {
    monter();
    ouvrirLaFiche();
    const fiche = ficheAuPremierPlan();

    expect(nonTraitees).toEqual([]);
    expect(fiche).toBeDefined();
    expect(fiche?.route?.params?.eventId).toBe(ID_RESERVATION);
  });

  it('aucun bouton de la fiche ne mene nulle part', () => {
    expect(gestesMorts(ouvrirLaFiche)).toEqual([]);
  });
});
