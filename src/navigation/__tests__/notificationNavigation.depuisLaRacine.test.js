import fs from 'fs';
import path from 'path';

import {
  createNavigatorFactory,
  NavigationContainer,
  useNavigationBuilder,
} from '@react-navigation/native';
import { StackRouter, TabRouter } from '@react-navigation/routers';
import { createElement } from 'react';
import { Platform, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { resolveInviteDestination } from '@/domains/invitations/InvitationLinkHost';

import { imbriquerDepuisLaRacine } from '@/navigation/hotesDepuisLaRacine';
import { navigate as navigateFromRoot, navigationRef } from '@/navigation/navigationService';
import { RouteNames } from '@/navigation/routeNames';

import { resolveNotificationDestination } from '@/utils/notifications/notificationNavigation';
import { NOTIFICATION_TYPES } from '@/utils/notifications/notificationTypes';

// La fenetre d invitation n est importee que pour sa decision PURE (resolveInviteDestination) :
// son stockage et son affichage sont neutralises.
jest.mock('@/domains/invitations/pendingInvite', () => ({
  clearPendingInvite: jest.fn(),
  readPendingInvite: jest.fn(() => null),
  savePendingInvite: jest.fn(),
}));
jest.mock('@/components/organisms/popup/GlobalPromptModal', () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));

/**
 * NAVMORTE2 (2026-09-11) -- TOUCHER UNE NOTIFICATION DANS LA LISTE NE FAIT RIEN.
 *
 * LE GESTE : `NotificationList.js:216` calcule la destination avec la fonction
 * PARTAGEE `resolveNotificationDestination` (utils/notifications/notificationNavigation.js:504),
 * puis `NotificationList.js:220` appelle `navigateFromRoot` (navigationService.js:55),
 * qui rend `true` des que le conteneur est pret -- le repli `nav.navigate` de la
 * ligne 222 ne tourne donc JAMAIS. Meme forme dans NotificationPopup.js:106-108.
 *
 * LE PIEGE : `navigationRef.navigate` dispatche sur le navigateur FOCALISE
 * (@react-navigation/core BaseNavigationContainer.tsx:125-136). La liste est montee
 * sur la pile RACINE (PrivateNavigator.js:522) : c est donc la racine qui recoit
 * l action. Si la route n y est pas, l action REMONTE vers les parents (il n y en a
 * pas) et ne DESCEND chez les enfants que si `navigationInChildEnabled` est pose
 * (core useOnAction.tsx, version 7.12.4) -- il ne l est nulle part dans l app.
 * Resultat : « not handled by any navigator », l ecran ne bouge pas.
 *
 * CE FILET MESURE DEUX CHOSES, SUR LE MEME ARBRE LU DANS LES FICHIERS :
 *   1. statique : la route de premier niveau de la destination est-elle ENREGISTREE
 *      sur la racine, et chaque `screen` imbrique existe-t-il dans le navigateur
 *      monte sous la route precedente ?
 *   2. dynamique : le geste de NotificationList.js:216-223 est REJOUE avec le vrai
 *      routeur de @react-navigation, le vrai `navigateFromRoot`, et un arbre dont
 *      chaque navigateur et chaque nom de route viennent des fichiers (aucune liste
 *      ecrite a la main : la lecon de allerDansLOnglet.test.js). L ecran atteint doit
 *      aussi RECEVOIR ses parametres (un correctif qui perdrait `matchId` ouvrirait un
 *      ecran vide).
 *
 * CE QU IL NE PROUVE PAS : le dessin des ecrans, leurs donnees, et le cas web
 * (`adaptDestinationForCurrentPlatform` reecrit les destinations LEAGUE sur le web,
 * et `buildWebPath` deroule les `screen` imbriques). Les navigateurs rejoues sont
 * MINIMAUX (motif de friendlyMatchWizardAtterrissage.test.js) : ils rendent TOUS
 * leurs ecrans, ce qui maximise les chances qu un enfant attrape l action -- s il
 * ne l attrape pas ici, il ne l attrape pas dans l app. `AdminStack` est monte sans
 * condition (dans l app : seulement si `isSuperAdmin`, PrivateNavigator.js:279).
 */

const SOURCES = path.join(__dirname, '..', '..');
const RACINE = path.join(__dirname, '..', 'private', 'PrivateNavigator.js');
const RACINE_PUBLIQUE = path.join(__dirname, '..', 'public', 'PublicMainNavigator.js');
const MOTIF_NAVIGATEUR = /create(?:Stack|NativeStack|BottomTab|MaterialTopTab|Drawer)Navigator\(/;
const MOTIF_ONGLETS = /create(?:BottomTab|MaterialTopTab|Drawer)Navigator\(/;

/**
 * Chemin lisible depuis `src/`.
 * @param {string} fichier le chemin absolu
 * @returns {string} le chemin relatif, en barres obliques
 */
const relatif = (fichier) => path.relative(SOURCES, fichier).split(path.sep).join('/');

/**
 * Resout un chemin d import ('@/x' ou relatif au fichier qui importe).
 * @param {string} depuis le fichier qui importe
 * @param {string} specifieur le chemin tel qu ecrit
 * @returns {string | undefined} le fichier, s il existe
 */
const resoudre = (depuis, specifieur) => {
  let base = '';
  if (specifieur.startsWith('@/')) base = path.join(SOURCES, specifieur.slice(2));
  else if (specifieur.startsWith('.')) base = path.resolve(path.dirname(depuis), specifieur);
  else return undefined;
  return ['', '.js', '.native.js', '/index.js']
    .map((suffixe) => path.normalize(`${base}${suffixe}`))
    .find((candidat) => fs.existsSync(candidat) && fs.statSync(candidat).isFile());
};

/**
 * @typedef {object} Noeud
 * @property {string} fichier le fichier du navigateur
 * @property {string[]} inconnues les cles de RouteNames introuvables
 * @property {Map<string, Noeud | null>} routes ses routes, et le navigateur monte sous chacune
 * @property {'onglets' | 'pile'} routeur le routeur a rejouer
 */

/**
 * Lit un navigateur : ses routes (par leur VALEUR de RouteNames) et, pour chaque
 * route qui monte un autre navigateur, ce navigateur lu a son tour.
 * @param {string} fichier le fichier du navigateur
 * @param {string[]} [parents] les fichiers deja traverses (garde anti-boucle)
 * @returns {Noeud} le navigateur lu
 */
const lireNavigateur = (fichier, parents = []) => {
  const source = fs.readFileSync(fichier, 'utf8');
  const imports = new Map(
    [...source.matchAll(/import\s+(\w+)\s+from\s+'([^']+)'/g)].map((m) => [m[1], m[2]]),
  );
  const ouvertures = [...source.matchAll(/<\w+\.Screen\b/g)].map((m) => Number(m.index));
  /** @type {Map<string, Noeud | null>} */
  const routes = new Map();
  /** @type {string[]} */
  const inconnues = [];

  [...source.matchAll(/name=\{RouteNames\.(\w+)\}/g)].forEach((m) => {
    const nom = /** @type {Record<string, unknown>} */ (RouteNames)[m[1]];
    if (typeof nom !== 'string') {
      inconnues.push(m[1]);
      return;
    }
    const debut = ouvertures.filter((indice) => indice < Number(m.index)).pop();
    const bloc = debut === undefined ? '' : source.slice(debut, m.index);
    const composant = bloc.match(/component=\{(\w+)\}/);
    const specifieur = bloc.match(/require\('([^']+)'\)/)?.[1]
      ?? (composant ? imports.get(composant[1]) : undefined);
    const cible = specifieur ? resoudre(fichier, specifieur) : undefined;
    const estNavigateur = typeof cible === 'string' && !parents.includes(cible)
      && MOTIF_NAVIGATEUR.test(fs.readFileSync(cible, 'utf8'));
    const enfant = typeof cible === 'string' && estNavigateur
      ? lireNavigateur(cible, [...parents, fichier])
      : null;
    if (!routes.has(nom)) routes.set(nom, enfant && enfant.routes.size > 0 ? enfant : null);
  });

  return {
    fichier,
    inconnues,
    routes,
    routeur: MOTIF_ONGLETS.test(source) ? 'onglets' : 'pile',
  };
};

/**
 * Pourquoi une destination est introuvable depuis un navigateur, ou `null` si elle y mene.
 * @param {Noeud} noeud le navigateur qui recoit l action
 * @param {string | undefined} route la route nommee
 * @param {any} params ses parametres (avec un eventuel `screen` imbrique)
 * @param {string[]} [chemin] les routes deja traversees
 * @returns {string | null} la raison, ou null
 */
const raisonDeMort = (noeud, route, params, chemin = []) => {
  const trace = [...chemin, String(route)].join(' > ');
  if (typeof route !== 'string' || !noeud.routes.has(route)) {
    return `${trace} : « ${String(route)} » n est pas enregistre dans ${relatif(noeud.fichier)}`;
  }
  if (typeof params?.screen !== 'string') return null;
  const enfant = noeud.routes.get(route);
  if (!enfant) return `${trace} : ecran feuille, « screen: ${params.screen} » ne mene nulle part`;
  return raisonDeMort(enfant, params.screen, params.params, [...chemin, route]);
};

/**
 * L ecran vise au bout d une destination (le dernier `screen` imbrique).
 * @param {any} destination { route, params }
 * @returns {string | undefined} le nom de l ecran
 */
const feuille = (destination) => (typeof destination?.params?.screen === 'string'
  ? feuille({ params: destination.params.params, route: destination.params.screen })
  : destination?.route);

const ARBRE = lireNavigateur(RACINE);

/**
 * Le navigateur monte sous une route de la racine.
 * @param {string} route la route de la racine
 * @returns {Noeud | null | undefined} le navigateur lu
 */
const sousLaRacine = (route) => ARBRE.routes.get(route);

/**
 * Toutes les routes inconnues de RouteNames, dans tout l arbre.
 * @param {Noeud} noeud le navigateur de depart
 * @returns {string[]} les cles introuvables
 */
const inconnuesDe = (noeud) => [
  ...noeud.inconnues.map((cle) => `${relatif(noeud.fichier)}:${cle}`),
  ...[...noeud.routes.values()].flatMap((enfant) => (enfant ? inconnuesDe(enfant) : [])),
];

// ---------------------------------------------------------------------------
// Le rejeu : des navigateurs minimaux batis sur les VRAIS routeurs.
// ---------------------------------------------------------------------------

/**
 * Fabrique de navigateur minimal : il rend TOUS ses ecrans (motif D24).
 * @param {any} Routeur StackRouter ou TabRouter
 * @returns {any} la fabrique createNavigatorFactory
 */
const fabriquerNavigateur = (Routeur) => {
  /**
   * Un navigateur minimal : le vrai routeur, et tous ses ecrans rendus.
   * @param {any} props les props du navigateur
   * @returns {any} le rendu
   */
  function NavigateurMinimal(props) {
    const { descriptors, NavigationContent, state } = useNavigationBuilder(Routeur, props);
    return createElement(
      NavigationContent,
      null,
      state.routes.map((/** @type {any} */ route) => descriptors[route.key].render()),
    );
  }
  return createNavigatorFactory(NavigateurMinimal);
};

const creerPile = fabriquerNavigateur(StackRouter);
const creerOnglets = fabriquerNavigateur(TabRouter);

/**
 * Un ecran feuille qui affiche son nom.
 * @param {string} nom la route
 * @returns {() => any} le composant
 */
const ecranTemoin = (nom) => function EcranTemoin() {
  return createElement(Text, null, nom);
};

/**
 * Le composant qui rejoue un navigateur lu, construit UNE fois (identite stable).
 * @param {Noeud} noeud le navigateur lu
 * @returns {() => any} le composant
 */
const composantDuNoeud = (noeud) => {
  const Navigateur = noeud.routeur === 'onglets' ? creerOnglets() : creerPile();
  const ecrans = [...noeud.routes.entries()].map(([nom, enfant]) => ({
    component: enfant ? composantDuNoeud(enfant) : ecranTemoin(nom),
    nom,
  }));
  return function NavigateurLu() {
    return createElement(
      Navigateur.Navigator,
      { id: undefined },
      ecrans.map(({ component, nom }) => createElement(
        Navigateur.Screen,
        { component, key: nom, name: nom },
      )),
    );
  };
};

const RacineRejouee = composantDuNoeud(ARBRE);

/** @type {any} */
let arbreRendu = null;
/** @type {string[]} */
let nonTraitees = [];

/**
 * Monte l arbre et ouvre la liste des notifications, comme l utilisateur.
 * `onUnhandledAction` ne change RIEN au traitement : il remplace seulement le
 * `console.error` par defaut (core BaseNavigationContainer.tsx:401-411) pour que
 * le temoin puisse LIRE ce qui n a ete pris par personne.
 * @returns {void}
 */
const ouvrirLaListe = () => {
  nonTraitees = [];
  act(() => {
    arbreRendu = renderer.create(createElement(
      NavigationContainer,
      {
        onUnhandledAction: (/** @type {any} */ action) => {
          nonTraitees.push(`${action.type} ${action.payload?.name}`);
        },
        ref: navigationRef,
      },
      createElement(RacineRejouee),
    ));
  });
  act(() => {
    /** @type {any} */ (navigationRef).navigate(RouteNames.NotificationList);
  });
};

/**
 * Monte l arbre et ouvre le tableau de bord LEAGUE. La bulle de notification y est
 * AUSSI montee (LeagueDashboard.js:612, MatchCenterScreen.js:3510) : de la, un nom nu
 * EndMatchScreen ou LeagueMatchTab etait pris par un navigateur parent et MARCHAIT
 * avant NAVMORTE2. L enveloppe ne doit pas le casser (relecture adverse, constat 6a).
 * @returns {void}
 */
const ouvrirLeTableauLeague = () => {
  ouvrirLaListe();
  act(() => {
    /** @type {any} */ (navigationRef).navigate(RouteNames.LeagueHomeTab, {
      screen: RouteNames.LeagueDashboard,
    });
  });
};

/**
 * La route de premier niveau qui a le focus : dit QUELLE copie d un ecran s est ouverte
 * quand la racine et une pile imbriquee portent le meme nom.
 * @returns {string | undefined} son nom
 */
const copieOuverte = () => {
  const racine = navigationRef.getRootState();
  return racine?.routes[racine.index]?.name;
};

/**
 * L ecran qui a le focus, au plus profond de l arbre.
 * @returns {string | undefined} son nom
 */
const ecranFocalise = () => navigationRef.getCurrentRoute()?.name;

/**
 * Les parametres recus par l ecran qui a le focus.
 * @returns {Record<string, unknown>} ses parametres, `{}` s il n en a pas
 */
const parametresFocalises = () => /** @type {any} */ (
  navigationRef.getCurrentRoute()?.params ?? {}
);

afterEach(() => {
  if (arbreRendu) act(() => arbreRendu.unmount());
  arbreRendu = null;
});

// ---------------------------------------------------------------------------
// Les destinations mortes signalees, construites par la VRAIE fonction partagee.
// ---------------------------------------------------------------------------

const CAS = [
  {
    charge: { type: NOTIFICATION_TYPES.LEAGUE_SEARCH_STARTED },
    ecran: RouteNames.LeagueMatchTab,
    nom: 'LeagueMatchTab : recherche lancee, repli (notificationNavigation.js:604)',
    parametres: {},
  },
  {
    // Charge REELLE : admin/src/api/league-match/services/league-notifications.js:344,
    // stockee telle quelle dans `data` (send-notifications.ts:733) et relue par la liste
    // (NotificationList.js:67-68) -> branche `ctaRoute` (notificationNavigation.js:508-513).
    charge: {
      ctaRoute: 'LeagueMatchTab',
      teamId: 'team-1',
      type: NOTIFICATION_TYPES.LEAGUE_SEARCH_STARTED,
    },
    ecran: RouteNames.LeagueMatchTab,
    nom: 'LeagueMatchTab : recherche lancee, ctaRoute SERVEUR (league-notifications.js:344)',
    parametres: {},
  },
  {
    charge: { matchId: 'match-1', type: NOTIFICATION_TYPES.LEAGUE_SCORE_START_INFO },
    ecran: RouteNames.EndMatchScreen,
    nom: 'EndMatchScreen : saisie du score, repli (notificationNavigation.js:571-578)',
    parametres: { matchId: 'match-1' },
  },
  {
    // Charge REELLE : league-notifications.js:1083-1087.
    charge: {
      ctaParams: { matchId: 'match-1', scoreFlowState: 'opponent_score_pending' },
      ctaRoute: 'EndMatchScreen',
      matchId: 'match-1',
      type: NOTIFICATION_TYPES.LEAGUE_SCORE_VALIDATION_REQUIRED,
    },
    ecran: RouteNames.EndMatchScreen,
    nom: 'EndMatchScreen : score a valider, ctaRoute SERVEUR (league-notifications.js:1083)',
    parametres: { matchId: 'match-1', scoreFlowState: 'opponent_score_pending' },
  },
  {
    charge: { type: NOTIFICATION_TYPES.SUBSCRIPTION_REPLACED },
    ecran: RouteNames.SubscriptionOverview,
    nom: 'SubscriptionOverview : abonnement remplace (notificationNavigation.js:981-984)',
    parametres: {},
  },
  {
    charge: {
      celebrationKey: 'club_licensee_quota_reached',
      licenseeCount: 100,
      memberCount: 100,
      type: 'celebration',
    },
    ecran: RouteNames.SubscriptionOverview,
    nom: 'SubscriptionOverview : quota de licencies atteint (notificationNavigation.js:546-557)',
    parametres: { licenseeCount: 100, memberCount: 100 },
  },
  {
    // Sans `ctaRoute`. Le serveur en pose un (event-admin-ops.ts:25-33, AdminStack >
    // AdminDashboard) : ce repli ne sert qu a une charge qui l a perdu.
    charge: { type: NOTIFICATION_TYPES.TEAM_FIRST_EVENT_CREATED },
    ecran: RouteNames.AdminDashboard,
    nom: 'AdminDashboard : 1er evenement, sans ctaRoute (notificationNavigation.js:985-988)',
    parametres: {},
  },
  {
    // Le gabarit serveur ne pose aucun ctaRoute (notification-templates.ts:242-252).
    charge: {
      eventId: 'evt-1',
      teamId: 'team-1',
      type: NOTIFICATION_TYPES.TOURNAMENT_TEAM_ROSTER_WARNING,
    },
    ecran: RouteNames.TournamentManagement,
    nom: 'TournamentManagement : alerte effectif tournoi (notificationNavigation.js:1006-1012)',
    parametres: { eventId: 'evt-1' },
  },
];

// ---------------------------------------------------------------------------
// Le balayage : TOUS les types connus x des charges qui ouvrent toutes les branches.
// ---------------------------------------------------------------------------

const IDS = {
  adId: 'ad-1',
  assignmentId: 'as-1',
  chatId: 'chat-1',
  clubId: 'club-1',
  eventId: 'evt-1',
  matchId: 'match-1',
  profileId: 'prof-1',
  teamId: 'team-1',
};

/** @type {Array<[string, Record<string, unknown>]>} */
const VARIANTES = [
  ['sans identifiant', {}],
  ['avec identifiants', IDS],
  ['match valide', { ...IDS, finalStatus: 'valid' }],
  ['demande refusee', { ...IDS, status: 'declined' }],
  ['revendication', { ...IDS, requestType: 'claim' }],
  ['alerte evenement', { alertType: 'event', eventId: 'evt-1' }],
  ['alerte mercato', { alertType: 'mercato', profileId: 'prof-1' }],
  ['invitation en attente', { invitationStatus: 'pending' }],
];

const TYPES = [...new Set(['newSelfServiceClub', ...Object.values(NOTIFICATION_TYPES)])];

/**
 * Chaque type x chaque variante -- plus la cle de quota, UNE fois : elle court-circuite
 * le type (notificationNavigation.js:546), l appliquer a tous repeterait 130 fois la
 * meme destination.
 * @type {Array<[string, Record<string, unknown>]>}
 */
const CHARGES = [
  ...TYPES.flatMap((type) => VARIANTES.map(([variante, extra]) => (
    /** @type {[string, Record<string, unknown>]} */ ([variante, { ...extra, type }])
  ))),
  ['quota', {
    celebrationKey: 'club_licensee_quota_reached',
    licenseeCount: 95,
    memberCount: 100,
    type: 'celebration',
  }],
];

/**
 * Calcule toutes les destinations et garde celles qui ne menent nulle part depuis la racine.
 * @returns {{ destinations: number, morts: string[] }} le compte et les destinations mortes
 */
const balayer = () => {
  let destinations = 0;
  /** @type {Map<string, string[]>} */
  const morts = new Map();
  CHARGES.forEach(([variante, charge]) => {
    const destination = resolveNotificationDestination(charge);
    if (!destination?.route) return;
    destinations += 1;
    const raison = raisonDeMort(ARBRE, destination.route, destination.params);
    if (!raison) return;
    const cle = `${String(charge.type)} -> ${raison}`;
    morts.set(cle, [...(morts.get(cle) || []), variante]);
  });
  const lignes = [...morts.entries()].map(([cle, variantes]) => `${cle} [${variantes.join(', ')}]`);
  return { destinations, morts: lignes.sort() };
};

describe('le filet mesure bien quelque chose', () => {
  it('l arbre est lu dans les fichiers, et le rejeu tourne en natif', () => {
    expect(Platform.OS).not.toBe('web');
    expect(inconnuesDe(ARBRE)).toEqual([]);
    expect(ARBRE.routes.size).toBeGreaterThan(60);
    expect(ARBRE.routes.has(RouteNames.NotificationList)).toBe(true);

    const accueil = sousLaRacine(RouteNames.HomeTab);
    expect(accueil && relatif(accueil.fichier)).toBe('navigation/private/PrivateTabNavigator.js');

    const league = sousLaRacine(RouteNames.LeagueHomeTab);
    expect(league && relatif(league.fichier)).toBe('navigation/private/LeagueTabNavigator.js');
    expect(league?.routeur).toBe('onglets');
    expect(league?.routes.has(RouteNames.LeagueMatchTab)).toBe(true);

    const pileLeague = league?.routes.get(RouteNames.LeagueDashboard);
    expect(pileLeague && relatif(pileLeague.fichier)).toBe('navigation/LeagueNavigator.js');
    expect(pileLeague?.routes.has(RouteNames.EndMatchScreen)).toBe(true);

    expect(sousLaRacine(RouteNames.ProfileStack)?.routes.has(RouteNames.SubscriptionOverview))
      .toBe(true);
    expect(sousLaRacine(RouteNames.EventStack)?.routes.has(RouteNames.TournamentManagement))
      .toBe(true);
    expect(sousLaRacine(RouteNames.AdminStack)?.routes.has(RouteNames.AdminDashboard)).toBe(true);

    expect(TYPES.length).toBeGreaterThan(50);
    expect(balayer().destinations).toBeGreaterThan(150);
    CAS.forEach(({ charge }) => expect(typeof charge.type).toBe('string'));
  });
});

describe('LE PIEGE, rejoue avec le vrai routeur (vert : decrit la bibliotheque)', () => {
  it('un nom nu d onglet n est pris par AUCUN navigateur, et navigateFromRoot rend true', () => {
    ouvrirLaListe();
    expect(ecranFocalise()).toBe(RouteNames.NotificationList);

    let aNavigue = false;
    act(() => {
      aNavigue = navigateFromRoot(RouteNames.LeagueMatchTab, {});
    });

    // true => le repli `nav.navigate` de NotificationList.js:222 ne tourne JAMAIS.
    expect(aNavigue).toBe(true);
    expect(ecranFocalise()).toBe(RouteNames.NotificationList);
    expect(nonTraitees).toEqual([`NAVIGATE ${RouteNames.LeagueMatchTab}`]);
  });

  // La FORME du correctif, prouvee sur le meme arbre avant de l ecrire -- ecran ET
  // parametres : ce harnais sait livrer les parametres imbriques jusqu a la feuille.
  it.each([
    [
      RouteNames.LeagueHomeTab,
      { params: {}, screen: RouteNames.LeagueMatchTab },
      RouteNames.LeagueMatchTab,
      {},
    ],
    [
      RouteNames.LeagueHomeTab,
      {
        params: { params: { matchId: 'match-1' }, screen: RouteNames.EndMatchScreen },
        screen: RouteNames.LeagueDashboard,
      },
      RouteNames.EndMatchScreen,
      { matchId: 'match-1' },
    ],
    [
      RouteNames.ProfileStack,
      { params: { licenseeCount: 100 }, screen: RouteNames.SubscriptionOverview },
      RouteNames.SubscriptionOverview,
      { licenseeCount: 100 },
    ],
    [
      RouteNames.AdminStack,
      { params: {}, screen: RouteNames.AdminDashboard },
      RouteNames.AdminDashboard,
      {},
    ],
    [
      RouteNames.EventStack,
      { params: { eventId: 'evt-1' }, screen: RouteNames.TournamentManagement },
      RouteNames.TournamentManagement,
      { eventId: 'evt-1' },
    ],
  ])('la forme imbriquee %s -> %p arrive depuis la liste', (route, params, ecran, attendus) => {
    ouvrirLaListe();
    act(() => {
      navigateFromRoot(route, params);
    });

    expect(ecranFocalise()).toBe(ecran);
    expect(parametresFocalises()).toEqual(expect.objectContaining(attendus));
    expect(nonTraitees).toEqual([]);
  });
});

describe('🚨 TOUCHER UNE NOTIFICATION DANS LA LISTE OUVRE SON ECRAN', () => {
  it.each(CAS)('$nom', ({ charge, ecran, parametres }) => {
    const destination = /** @type {any} */ (resolveNotificationDestination(charge));
    // Precondition, vraie AVANT et APRES le correctif : la fonction partagee vise cet ecran.
    expect(feuille(destination)).toBe(ecran);

    ouvrirLaListe();
    expect(ecranFocalise()).toBe(RouteNames.NotificationList);

    // Le geste de NotificationList.js:216-223, a l identique.
    let aNavigue = false;
    act(() => {
      aNavigue = navigateFromRoot(destination.route, destination.params || {});
    });

    expect({
      actionsNonTraitees: nonTraitees,
      cheminDansLArbre: raisonDeMort(ARBRE, destination.route, destination.params),
      ecranApresLAppui: ecranFocalise(),
      navigateFromRootRend: aNavigue,
      parametresDeLEcran: parametresFocalises(),
    }).toEqual({
      actionsNonTraitees: [],
      cheminDansLArbre: null,
      ecranApresLAppui: ecran,
      navigateFromRootRend: true,
      parametresDeLEcran: expect.objectContaining(parametres),
    });
  });

  it('balayage : AUCUN type connu ne produit une destination introuvable depuis la racine', () => {
    expect(balayer().morts).toEqual([]);
  });

  // GARDE-FOU DU CORRECTIF (vert aujourd hui) : ce qui marche doit continuer de marcher,
  // jusqu a la feuille, et viser le MEME ecran.
  it.each([
    [
      { eventId: 'evt-1', type: NOTIFICATION_TYPES.EVENT_UPDATED },
      RouteNames.EventDetails,
    ],
    [
      { teamId: 'team-1', type: NOTIFICATION_TYPES.TEAM_MEMBERSHIP_REQUEST },
      RouteNames.TeamMembershipRequests,
    ],
    [
      { matchId: 'match-1', type: NOTIFICATION_TYPES.LEAGUE_MATCH_FOUND },
      RouteNames.LeagueMatchTab,
    ],
    [
      // Charge REELLE : league-notifications.js:384-392.
      {
        ctaParams: { params: { matchId: 'match-1' }, screen: 'LeagueDashboard' },
        ctaRoute: 'LeagueHomeTab',
        type: NOTIFICATION_TYPES.LEAGUE_MATCH_FOUND,
      },
      RouteNames.LeagueDashboard,
    ],
    [
      // Charge REELLE : admin/src/api/event/services/event-admin-ops.ts:25-33.
      {
        ctaParams: { params: { highlight: 'first-team-events' }, screen: 'AdminDashboard' },
        ctaRoute: 'AdminStack',
        type: NOTIFICATION_TYPES.TEAM_FIRST_EVENT_CREATED,
      },
      RouteNames.AdminDashboard,
    ],
    [
      { type: 'newSelfServiceClub' },
      RouteNames.AdminClubOnboardingList,
    ],
    [
      { clubId: 'club-1', requestType: 'claim', type: NOTIFICATION_TYPES.CLUB_MEMBERSHIP_REQUEST },
      RouteNames.ClubMembershipRequests,
    ],
    [
      { alertType: 'mercato', profileId: 'prof-1', type: NOTIFICATION_TYPES.SEARCH_ALERT_MATCH },
      RouteNames.UserDetails,
    ],
    [
      { eventId: 'evt-1', teamId: 'team-1', type: NOTIFICATION_TYPES.TOURNAMENT_TEAM_INVITATION },
      RouteNames.TournamentTeamDetails,
    ],
    [
      { matchId: 'match-1', type: NOTIFICATION_TYPES.LEAGUE_PROPOSAL_ACCEPTED },
      RouteNames.LeagueMatchDetails,
    ],
    [
      { chatId: 'chat-1', type: NOTIFICATION_TYPES.NEW_WHISPER },
      RouteNames.Conversation,
    ],
    [
      { type: NOTIFICATION_TYPES.TEAM_REQUEST },
      RouteNames.RequestsHub,
    ],
  ])('deja juste, et doit le rester : %p -> %s', (charge, ecran) => {
    const destination = /** @type {any} */ (resolveNotificationDestination(charge));

    expect({
      cheminDansLArbre: raisonDeMort(ARBRE, destination?.route, destination?.params),
      ecranVise: feuille(destination),
    }).toEqual({ cheminDansLArbre: null, ecranVise: ecran });
  });
});

describe('NAVMORTE2, relecture adverse -- ce que le premier filet ne voyait pas', () => {
  // Constat 2. La racine monte AUSSI un SubscriptionOffers : le SAS de fin d inscription
  // (PrivateNavigator.js:988-1009), avec resumeRouteName Welcome et skipRouteName
  // OnboardingGift en parametres initiaux, fusionnes dans ceux du navigate. Un nom nu
  // depuis la racine ouvre CETTE copie : « Continuer gratuitement » mene a la page cadeau,
  // puis a Welcome, qui repropose le tour guide. Le nom existe a la racine, donc
  // raisonDeMort ne voyait rien : ici on regarde QUELLE copie s ouvre.
  it.each([
    [
      NOTIFICATION_TYPES.SUBSCRIPTION_ENDED,
      { planCode: 'fc_trial_club', type: NOTIFICATION_TYPES.SUBSCRIPTION_ENDED },
      'CLUB',
    ],
    [
      NOTIFICATION_TYPES.SUBSCRIPTION_PAYMENT_FAILED,
      { planCode: 'fc_team_2_yearly', type: NOTIFICATION_TYPES.SUBSCRIPTION_PAYMENT_FAILED },
      'TEAM',
    ],
  ])('%s ouvre les offres du PROFIL, pas le sas d inscription', (_type, charge, focusScope) => {
    const destination = /** @type {any} */ (resolveNotificationDestination(charge));
    expect(feuille(destination)).toBe(RouteNames.SubscriptionOffers);

    ouvrirLaListe();
    act(() => {
      navigateFromRoot(destination.route, destination.params || {});
    });

    expect({
      actionsNonTraitees: nonTraitees,
      copie: copieOuverte(),
      ecranApresLAppui: ecranFocalise(),
      parametresDeLEcran: parametresFocalises(),
    }).toEqual({
      actionsNonTraitees: [],
      copie: RouteNames.ProfileStack,
      ecranApresLAppui: RouteNames.SubscriptionOffers,
      parametresDeLEcran: expect.objectContaining({ focusScope }),
    });
  });

  // Constat 6a -- garde-fou, vert avant et apres : depuis le tableau LEAGUE, la forme
  // imbriquee arrive au meme ecran, avec les memes parametres.
  const CAS_LEAGUE = CAS.filter(({ ecran }) => (
    [RouteNames.EndMatchScreen, RouteNames.LeagueMatchTab].includes(ecran)
  ));

  it('le garde-fou LEAGUE couvre bien 4 cas', () => {
    expect(CAS_LEAGUE).toHaveLength(4);
  });

  it.each(CAS_LEAGUE)('depuis le tableau LEAGUE aussi : $nom', ({ charge, ecran, parametres }) => {
    const destination = /** @type {any} */ (resolveNotificationDestination(charge));

    ouvrirLeTableauLeague();
    expect(copieOuverte()).toBe(RouteNames.LeagueHomeTab);

    act(() => {
      navigateFromRoot(destination.route, destination.params || {});
    });

    expect({
      actionsNonTraitees: nonTraitees,
      ecranApresLAppui: ecranFocalise(),
      parametresDeLEcran: parametresFocalises(),
    }).toEqual({
      actionsNonTraitees: [],
      ecranApresLAppui: ecran,
      parametresDeLEcran: expect.objectContaining(parametres),
    });
  });
});

describe('NAVMORTE2, relecture adverse -- la fenetre d invitation, meme piege', () => {
  // Constat 1. InvitationLinkHost.js:191 navigue depuis la racine avec les noms nus de
  // resolveInviteDestination : Club, EventDetails, TeamDetails. Connecte, ces ecrans ne
  // vivent que dans ClubStack, EventStack et TeamStack : « Voir le club » ne faisait RIEN.
  // Deconnecte, la racine publique les porte nus (PublicMainNavigator.js:61-93) : la forme
  // depend donc de la racine REELLE, d ou la liste de ses routes passee en second argument.
  const ARBRE_PUBLIC = lireNavigateur(RACINE_PUBLIQUE);
  const INVITATIONS = [
    { id: 'c-1', subject: 'club' },
    { id: 'e-1', subject: 'event' },
    { id: 's-1', subject: 'squad' },
    { id: 't-1', subject: 'team' },
  ];

  it('la racine publique est lue, et ne porte aucune pile de la racine connectee', () => {
    expect(inconnuesDe(ARBRE_PUBLIC)).toEqual([]);
    expect(ARBRE_PUBLIC.routes.has(RouteNames.Club)).toBe(true);
    expect(ARBRE_PUBLIC.routes.has(RouteNames.ClubStack)).toBe(false);
    expect(ARBRE_PUBLIC.routes.has(RouteNames.EventStack)).toBe(false);
    expect(ARBRE_PUBLIC.routes.has(RouteNames.TeamStack)).toBe(false);
  });

  it.each(INVITATIONS)('connecte : « $subject » mene a son ecran depuis la racine', (invite) => {
    const nue = /** @type {any} */ (resolveInviteDestination(invite));
    const destination = /** @type {any} */ (
      imbriquerDepuisLaRacine(nue, [...ARBRE.routes.keys()])
    );

    ouvrirLaListe();
    act(() => {
      navigateFromRoot(destination.route, destination.params || {});
    });

    expect({
      actionsNonTraitees: nonTraitees,
      cheminDansLArbre: raisonDeMort(ARBRE, destination.route, destination.params),
      ecranApresLAppui: ecranFocalise(),
      parametresDeLEcran: parametresFocalises(),
    }).toEqual({
      actionsNonTraitees: [],
      cheminDansLArbre: null,
      ecranApresLAppui: nue.route,
      parametresDeLEcran: expect.objectContaining(nue.params),
    });
  });

  it.each(INVITATIONS)('deconnecte : « $subject » garde la forme publique', (invite) => {
    const nue = /** @type {any} */ (resolveInviteDestination(invite));
    const destination = /** @type {any} */ (
      imbriquerDepuisLaRacine(nue, [...ARBRE_PUBLIC.routes.keys()])
    );

    expect({
      cheminDansLArbre: raisonDeMort(ARBRE_PUBLIC, destination.route, destination.params),
      destination,
    }).toEqual({ cheminDansLArbre: null, destination: nue });
  });
});
