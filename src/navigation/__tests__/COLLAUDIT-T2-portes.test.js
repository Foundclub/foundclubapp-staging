/**
 * COLLAUDIT T2 — LES PORTES D'ENTREE DES ECRANS « STRUCTURE » ET « INSTALLATION ».
 *
 * Lot 0 AUDIT du chantier Collectivites (2026-09-27). TEMOIN DE CARACTERISATION :
 * il decrit ce que le code fait AUJOURD'HUI et il doit etre VERT. Il ne juge rien.
 *
 * CE QUE LA COLLECTIVITE EXIGERA (D:/App/fc/SPEC_COLLECTIVITES_2026-09.md) :
 *   - §2 C : le gestionnaire ouvre un planning « toutes installations » et un
 *     planning par installation -> il lui faut une PORTE vers le planning
 *     unifie (route CMPlanning, aujourd'hui sans aucun bouton) ;
 *   - §3 et D2 : TOUT membre ouvre son club, puis l'installation, puis le
 *     planning, y compris pour une installation de la mairie (aujourd'hui une
 *     installation « partagee » de la structure, dont le bouton « Voir planning »
 *     est reserve a l'encadrement) ;
 *   - §2 B : le gestionnaire gere SES installations depuis SON espace (aujourd'hui
 *     aucun bouton de CMDashboard ne mene a la liste des installations).
 * Le jour ou ces portes sont posees, les tests concernes deviennent ROUGES : on
 * les met a jour ce jour-la, on ne les supprime pas.
 *
 * Methode : une carte des appelants (scan statique de src/, meme lecture que
 * webRoutes.parity.test.js), la VRAIE config des liens profonds rendue par
 * appNavigator.js (meme montage que linking.routesAtteignables.test.js), les
 * VRAIES adresses du site (buildWebPath), et un rendu de MyEventList.
 */
import fs from 'fs';
import path from 'path';

import { getStateFromPath } from '@react-navigation/native';
import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import MyEventList from '@/views/event/MyEventList';

import AppNavigator from '../appNavigator';
import { RouteNames } from '../routeNames';
import { buildWebPath, WEB_ROUTE_PATTERNS } from '../webRoutes';

// --- Doublures : aucun module de src/services n'est charge par ce temoin. ---
const mockLinkings = /** @type {any[]} */ ([]);
const mockRendus = /** @type {Array<[string, any]>} */ ([]);
let mockEtatApp = /** @type {any} */ ({ auth: null, isAddingAccount: false });
let mockAuth = /** @type {any} */ ({ userData: null });
let mockScope = /** @type {any} */ ({});

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  __esModule: true,
  NavigationContainer: (/** @type {any} */ props) => {
    mockLinkings.push(props.linking);
    return null;
  },
}));
jest.mock('@/store/appContext', () => ({
  __esModule: true,
  useAppContext: () => [mockEtatApp],
}));
jest.mock('@/theme/themeContext', () => ({
  __esModule: true,
  default: () => ({
    ApplicationStyle: { darkNavigationTheme: {}, lightNavigationTheme: {} },
    Colors: {},
    scheme: 'light',
  }),
}));
jest.mock('@/utils/logger/logger', () => ({
  __esModule: true,
  createLogger: () => ({
    debug: () => {}, error: () => {}, info: () => {}, warn: () => {},
  }),
}));
jest.mock('@/navigation/navigationService', () => ({
  __esModule: true,
  navigationRef: { getCurrentRoute: () => null },
}));
jest.mock('@/components/molecules/tour/TourBanner', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/navigation/private/PrivateNavigator', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../public/PublicMainNavigator', () => ({
  __esModule: true,
  default: () => null,
}));
// MyEventList : ses dependances, doublees en entier.
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => mockAuth,
}));
jest.mock('@/context/ClubScopeContext', () => ({
  __esModule: true,
  useClubScope: () => mockScope,
}));
jest.mock('@/domains/tutorial/tutorialIds', () => ({
  __esModule: true,
  TutorialIds: { PLANNING: 'planning' },
}));
jest.mock('@/components/organisms/planning/CMPlanningContent', () => ({
  __esModule: true,
  default: (/** @type {any} */ props) => {
    mockRendus.push(['CMPlanningContent', props]);
    return null;
  },
}));
jest.mock('@/views/event/ParticipantEventList', () => ({
  __esModule: true,
  default: (/** @type {any} */ props) => {
    mockRendus.push(['ParticipantEventList', props]);
    return null;
  },
}));
jest.mock('@/components/templates/ScreenContainer', () => ({
  __esModule: true,
  default: (/** @type {any} */ { children }) => children,
}));
jest.mock('@/views/event/MyEventListTutorialBoundary', () => ({
  __esModule: true,
  default: (/** @type {any} */ { children }) => children,
}));

const NAVIGATION = path.join(__dirname, '..');
const SOURCES = path.join(NAVIGATION, '..');

/**
 * Le chemin d un fichier, lu depuis src/.
 * @param {string} fichier un chemin absolu
 * @returns {string} le chemin depuis src/, en barres obliques
 */
const relatif = (fichier) => path.relative(SOURCES, fichier).split(path.sep).join('/');

/**
 * Lit un fichier de src/.
 * @param {string} chemin le chemin depuis src/
 * @returns {string} son contenu
 */
const lire = (chemin) => fs.readFileSync(path.join(SOURCES, chemin), 'utf8');

/**
 * Les fichiers source de src/ (tests exclus), comme webRoutes.parity.test.js.
 * @param {string} dossier un dossier absolu
 * @returns {string[]} les fichiers
 */
const sources = (dossier) => fs.readdirSync(dossier, { withFileTypes: true })
  .flatMap((entree) => {
    const complet = path.join(dossier, entree.name);
    if (entree.isDirectory()) {
      const ignore = ['__snapshots__', '__tests__', 'node_modules'].includes(entree.name);
      return ignore ? [] : sources(complet);
    }
    if (!/\.(js|jsx|ts|tsx)$/.test(entree.name)) return [];
    if (/\.(test|spec)\.(js|jsx|ts|tsx)$/.test(entree.name)) return [];
    return [complet];
  });

const FICHIERS = sources(SOURCES);
// Les fichiers qui DECLARENT une route (nom, adresse web) sans y mener personne.
const DECLARATIONS = new Set(['navigation/routeNames.js', 'navigation/webRoutes.js']);

/**
 * Les fichiers qui visent une route SANS l enregistrer : navigate, push,
 * replace, cible d une carte ou d une notification. Une ligne
 * `name={RouteNames.X}` est un enregistrement, pas une porte.
 * @param {string} route le nom de la route
 * @returns {string[]} les fichiers appelants, tries
 */
const appelantsDe = (route) => {
  const vise = new RegExp(`RouteNames\\.${route}\\b|['"]${route}['"]`);
  const enregistre = new RegExp(`name=\\{RouteNames\\.${route}\\}`);
  return FICHIERS
    .filter((fichier) => !DECLARATIONS.has(relatif(fichier)))
    .filter((fichier) => fs.readFileSync(fichier, 'utf8').split('\n')
      .some((ligne) => vise.test(ligne) && !enregistre.test(ligne)))
    .map(relatif)
    .sort();
};

/**
 * Les routes enregistrees par un fichier de navigation.
 * @param {string} chemin le chemin depuis src/
 * @returns {Set<string>} les noms de routes
 */
const routesDe = (chemin) => new Set(
  [...lire(chemin).matchAll(/name=\{RouteNames\.(\w+)\}/g)].map((m) => m[1]),
);

/**
 * Tous les noms d ecran cites par une config de liens profonds, a tout niveau.
 * @param {Record<string, any>} screens le champ `screens` d une config linking
 * @returns {string[]} les noms
 */
const ecransDe = (screens) => Object.entries(screens).flatMap(([nom, valeur]) => (
  valeur && typeof valeur === 'object' && valeur.screens
    ? [nom, ...ecransDe(valeur.screens)]
    : [nom]
));

/**
 * Monte appNavigator.js connecte et rend la config linking passee au conteneur.
 * @returns {{ screens: Record<string, any> }} la config du mode connecte
 */
const configConnectee = () => {
  mockEtatApp = { auth: { token: 'jeton-temoin' }, isAddingAccount: false };
  mockLinkings.length = 0;
  act(() => {
    renderer.create(createElement(AppNavigator, {
      navigationIntegration: { registerNavigationContainer: () => {} },
    }));
  });
  return mockLinkings[mockLinkings.length - 1]?.config;
};

/**
 * Rend l onglet Planning (MyEventList) et dit quel contenu il a monte.
 * @param {any} userData le compte connecte
 * @param {any} scope le perimetre choisi (ClubScopeContext)
 * @returns {Array<[string, any]>} les contenus montes
 */
const rendreOngletPlanning = (userData, scope) => {
  mockAuth = { userData };
  mockScope = scope;
  mockRendus.length = 0;
  act(() => {
    renderer.create(createElement(MyEventList, {
      navigation: { setParams: () => {} },
      route: { params: {} },
    }));
  });
  return [...mockRendus];
};

// Les ecrans de l audit, et les fichiers qui y menent AUJOURD'HUI.
const APPELANTS_AUJOURDHUI = {
  [RouteNames.CMDashboard]: ['views/home/HomeHub.js', 'views/profile/Profile.js'],
  [RouteNames.CMMembers]: ['views/multisportClub/CMDashboard.js'],
  [RouteNames.CMPlanning]: [],
  [RouteNames.CMTeams]: ['views/multisportClub/CMDashboard.js'],
  [RouteNames.CreateSection]: [
    'views/multisportClub/CMDashboard.js',
    'views/multisportClub/MultisportClubDetails.js',
  ],
  [RouteNames.FacilityForm]: [
    'views/club/ClubDetails.js',
    'views/event/wizard/EventWizardLocation.js',
    'views/event/wizard/EventWizardStageProgram.js',
    'views/facility/FacilityList.js',
    'views/recruitment/wizard/AdWizardLocation.js',
  ],
  [RouteNames.FacilityList]: [
    'views/club/ClubDetails.js',
    'views/facility/FacilityForm.js',
    'views/team/TeamDetails.js',
  ],
  [RouteNames.FeaturedRequests]: [],
  [RouteNames.MultisportClubDetails]: [
    'components/organisms/clubListContent/ClubListContent.js',
    'platform/maps/searchMapDetailNavigation.js',
  ],
  [RouteNames.MultisportClubEdit]: [
    'views/multisportClub/CMDashboard.js',
    'views/multisportClub/MultisportClubDetails.js',
  ],
  [RouteNames.MyClubs]: ['views/multisportClub/CMDashboard.js'],
};

describe('COLLAUDIT T2 — les portes des ecrans structure et installation', () => {
  test("AUJOURD'HUI : le scan lit bien les sources (garde anti-test-vide)", () => {
    expect(FICHIERS.length).toBeGreaterThan(500);
    expect(appelantsDe(RouteNames.CMDashboard).length).toBeGreaterThan(0);
  });

  test("AUJOURD'HUI : les 11 routes de l audit sont montees a la racine connectee", () => {
    const racine = routesDe('navigation/private/PrivateNavigator.js');
    Object.keys(APPELANTS_AUJOURDHUI).forEach((route) => {
      expect(racine.has(route)).toBe(true);
    });
    // FacilityList, FacilityForm et MultisportClubEdit sont AUSSI dans ClubStack.
    const pileClub = routesDe('navigation/private/stacks/ClubStack.js');
    expect([RouteNames.FacilityList, RouteNames.FacilityForm, RouteNames.MultisportClubEdit]
      .filter((route) => pileClub.has(route))).toHaveLength(3);
  });

  test("AUJOURD'HUI : la carte des appelants, route par route", () => {
    const mesure = Object.fromEntries(
      Object.keys(APPELANTS_AUJOURDHUI).map((route) => [route, appelantsDe(route)]),
    );
    expect(mesure).toEqual(APPELANTS_AUJOURDHUI);
  });

  test("AUJOURD'HUI : CMPlanning et FeaturedRequests n ont AUCUN appelant (sans porte)", () => {
    expect(appelantsDe(RouteNames.CMPlanning)).toEqual([]);
    expect(appelantsDe(RouteNames.FeaturedRequests)).toEqual([]);
    // ...et le registre des routes le dit lui-meme (TODO nav-sans-porte).
    const registre = lire('navigation/routeNames.js');
    expect(registre).toMatch(/TODO\(nav-sans-porte\)[\s\S]*`CMPlanning`, `FeaturedRequests`/);
  });

  test("AUJOURD'HUI : l onglet « Club » monte CMDashboard pour un encadrant de structure", () => {
    const onglets = lire('navigation/private/PrivateTabNavigator.js');
    expect(onglets).toMatch(/const hasMultisportAccess = Boolean\(userData\?\.multisportClubs\?\.length > 0\);/);
    expect(onglets).toMatch(
      /if \(canManageTeam && hasMultisportAccess && !isSectionScope\) \{\s*return require\('@\/views\/multisportClub\/CMDashboard'\)\.default;/,
    );
  });

  test("AUJOURD'HUI : CMDashboard n a AUCUN bouton vers le planning ni les installations", () => {
    const tableau = lire('views/multisportClub/CMDashboard.js');
    const cibles = [...tableau.matchAll(/RouteNames\.(\w+)/g)].map((m) => m[1]);
    expect([...new Set(cibles)].sort()).toEqual([
      'AdWizardStack',
      'AddSponsor',
      'CMLicensesDashboard',
      'CMMembers',
      'CMTeams',
      'ClubStack',
      'Club',
      'CreateSection',
      'EventStack',
      'EventWizardType',
      'MultisportClubEdit',
      'MyClubs',
      'ProfileStack',
      'UserDetails',
    ].sort());
    expect(cibles).not.toContain(RouteNames.CMPlanning);
    expect(cibles).not.toContain(RouteNames.FacilityList);
  });

  test("AUJOURD'HUI : l onglet Planning du gestionnaire monte le planning unifie", () => {
    const gestionnaire = {
      documentId: 'user-gestionnaire',
      multisportClubs: [{ documentId: 'cm-demo' }],
    };
    const montes = rendreOngletPlanning(gestionnaire, {
      activeMode: 'multisport',
      activeMultisportClubId: 'cm-demo',
    });
    expect(montes.map(([nom]) => nom)).toEqual(['CMPlanningContent']);
    expect(montes[0][1].cmId).toBe('cm-demo');
  });

  test("AUJOURD'HUI : membre simple ou mode section : l onglet Planning = ses evenements", () => {
    const membre = { documentId: 'user-membre', multisportClubs: [] };
    expect(rendreOngletPlanning(membre, { activeMode: 'multisport' }).map(([nom]) => nom))
      .toEqual(['ParticipantEventList']);
    const gestionnaire = {
      documentId: 'user-gestionnaire',
      multisportClubs: [{ documentId: 'cm-demo' }],
    };
    expect(rendreOngletPlanning(gestionnaire, { activeMode: 'section' }).map(([nom]) => nom))
      .toEqual(['ParticipantEventList']);
  });

  test("AUJOURD'HUI : le mode par defaut d un gestionnaire de structure est « multisport »", () => {
    const perimetre = lire('context/ClubScopeContext.js');
    expect(perimetre).toMatch(
      /let activeMode = 'multisport';\s*if \(!hasMultisportAccess && currentClubId\) \{\s*activeMode = 'section';\s*\}/,
    );
  });

  test("AUJOURD'HUI : « Voir planning » d une installation PARTAGEE = encadrement seul", () => {
    const fiche = lire('views/club/ClubDetails.js');
    expect(fiche).toMatch(/&& \(facility\?\.isShared \? canAccessSharedPlanning : isMember\),/);
    expect(fiche).toMatch(
      /Boolean\(resolvedFacilityCmId\)\s*&& \(isParentClubAdmin \|\| isPresidentOfViewedClub \|\| isCoachOfViewedClub \|\| isMultisportAdmin\)/,
    );
    // L onglet « Planning » de la fiche : membres seulement, jamais le dirigeant (hub).
    expect(fiche).toMatch(/if \(isMember\) \{\s*options\.push\(\{ label: t\('clubDetails\.tabs\.planning', 'Planning'\), value: 'planning' \}\);/);
    expect(fiche).toMatch(/\{canEdit \? null : \(\s*<View style=\{\[Alignments\.alignCenter\]\}>\s*<SegmentedControl/);
    const conteneur = lire('components/organisms/planning/ClubFacilityPlanningContainer.js');
    expect(conteneur).toMatch(
      /&& \(allowSharedPlanning \|\| \(canManageTeam && \(isPresidentOfClub \|\| isCoachOfClub \|\| isMultisportAdmin\)\)\),/,
    );
  });

  test("AUJOURD'HUI : « Voir le planning » de FacilityList revient sur la fiche club", () => {
    const liste = lire('views/facility/FacilityList.js');
    expect(liste).toMatch(
      /planningFacilityId: facilityId,\s*planningScope: facility\?\.isShared \? 'shared' : 'club',\s*\},\s*screen: RouteNames\.Club,\s*stack: RouteNames\.ClubStack,/,
    );
    const fiche = lire('views/club/ClubDetails.js');
    expect(fiche).toMatch(/route\?\.params\?\.planningFacilityId \? 'planning' : 'infos',/);
  });

  test("AUJOURD'HUI : les liens profonds foundclub:// ne visent aucun ecran de structure ni d installation", () => {
    const config = configConnectee();
    const ecrans = ecransDe(config.screens);
    expect(ecrans).toEqual(expect.arrayContaining([RouteNames.ClubStack, RouteNames.Club]));
    [
      ...Object.keys(APPELANTS_AUJOURDHUI),
      RouteNames.PlanningWeekFullscreen,
      RouteNames.MyEventList,
    ].forEach((route) => {
      expect(ecrans).not.toContain(route);
    });
  });

  test("AUJOURD'HUI : le lien profond d un club porte le planning d une installation", () => {
    const config = configConnectee();
    const etat = /** @type {any} */ (
      getStateFromPath('club/club-1?planningFacilityId=fac-1&planningScope=shared', config)
    );
    expect(etat.routes[0].name).toBe(RouteNames.ClubStack);
    const fiche = etat.routes[0].state.routes[0];
    expect(fiche.name).toBe(RouteNames.Club);
    expect(fiche.params).toEqual({
      clubId: 'club-1',
      planningFacilityId: 'fac-1',
      planningScope: 'shared',
    });
  });

  test("AUJOURD'HUI : les adresses du site des deux plannings", () => {
    expect(WEB_ROUTE_PATTERNS[RouteNames.CMPlanning]).toBe('/multisport/:cmId/planning');
    // buildWebPath RECOPIE les parametres de chemin dans la requete : `reservedKeys`
    // est calcule APRES le remplacement de `:cmId` (webRoutes.js:299-301), il est
    // donc toujours vide quand le parametre est fourni. Sans effet connu, mesure ici.
    expect(buildWebPath(RouteNames.CMPlanning, { cmId: 'cm-demo' }))
      .toBe('/multisport/cm-demo/planning?cmId=cm-demo');
    expect(buildWebPath(RouteNames.CMDashboard, { cmId: 'cm-demo' }))
      .toBe('/multisport/cm-demo/dashboard?cmId=cm-demo');
    expect(buildWebPath(RouteNames.MyEventList)).toBe('/events/mine');
    // Le planning d UNE installation n a pas de route : c est l onglet de la fiche club.
    expect(buildWebPath(RouteNames.Club, {
      clubId: 'club-1',
      planningFacilityId: 'fac-1',
      planningScope: 'club',
    })).toBe('/clubs/club-1?clubId=club-1&planningFacilityId=fac-1&planningScope=club');
    // Le meme, en plein ecran (bouton du conteneur de planning).
    expect(buildWebPath(RouteNames.PlanningWeekFullscreen, {
      clubId: 'club-1',
      facilityId: 'fac-1',
      sourceType: 'club',
    })).toBe('/planning/week?clubId=club-1&facilityId=fac-1&sourceType=club');
    expect(buildWebPath(RouteNames.PlanningWeekFullscreen, { cmId: 'cm-demo', sourceType: 'cm' }))
      .toBe('/planning/week?cmId=cm-demo&sourceType=cm');
  });

  test("AUJOURD'HUI : sur le site, « Modifier » une installation = adresse de la liste", () => {
    // FacilityList.handleEdit et ClubDetails passent l objet `facility`, jamais
    // `facilityId` : buildWebPath jette les objets (webRoutes.js, buildQueryString).
    const liste = buildWebPath(RouteNames.FacilityList, { clubId: 'club-1', cmId: 'cm-demo' });
    const modifier = buildWebPath(RouteNames.FacilityForm, {
      clubId: 'club-1',
      cmId: 'cm-demo',
      facility: { documentId: 'fac-1', name: 'Gymnase' },
    });
    const ajouter = buildWebPath(RouteNames.FacilityForm, { clubId: 'club-1', cmId: 'cm-demo' });
    expect(liste).toBe('/facilities?clubId=club-1&cmId=cm-demo');
    expect(modifier).toBe(liste);
    expect(ajouter).toBe(liste);
    expect(buildWebPath(RouteNames.FacilityForm, { facilityId: 'fac-1' }))
      .toBe('/facilities/fac-1?facilityId=fac-1');
  });
});
