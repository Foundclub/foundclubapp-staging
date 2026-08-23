import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import { RouteNames } from '@/navigation/routeNames';

import EventWizardAccess from '../EventWizardAccess';
import { EventWizardProvider, useEventWizard } from '../EventWizardContext';
import EventWizardDescription from '../EventWizardDescription';
import {
  getEventWizardExitRoute,
  getEventWizardNextRoute,
  getEventWizardStepRoutes,
} from '../eventWizardDetectionUtils';
import EventWizardInvites from '../EventWizardInvites';
import EventWizardLocation from '../EventWizardLocation';
import EventWizardLogistics from '../EventWizardLogistics';
import EventWizardOpponent from '../EventWizardOpponent';
import EventWizardParticipants from '../EventWizardParticipants';
import EventWizardRecap from '../EventWizardRecap';
import EventWizardStageProgram from '../EventWizardStageProgram';
import EventWizardTeam from '../EventWizardTeam';
import EventWizardTournamentSettings from '../EventWizardTournamentSettings';
import EventWizardTournamentStructure from '../EventWizardTournamentStructure';
import EventWizardType from '../EventWizardType';

// Filet D08 (E6) — moitie TRANSITIONS. La moitie NUMEROS vit dans
// `eventWizardDetectionUtils.test.js`.
//
// Ce que ce fichier prouve : en partant de l'ecran « Type » et en appuyant
// toujours sur « Suivant », quelle SUITE D'ECRANS traverse-t-on, type
// d'evenement par type d'evenement. C'est le test qui doit rougir quand la
// machine change de forme — c'est son but.
//
// Il prouve aussi que les ecrans hors chemin standard sont ATTEIGNABLES :
// StageProgram, TournamentSettings et TournamentStructure par un parcours reel,
// et `EventWizardInvites` — que D08 a sorti de la chaine — par le lien
// « Modifier » du Recap. C'est le garde-fou contre la pire regression du
// projet, du code devenu inatteignable.
//
// ETAT DU 2026-08-06, APRES D08.
//
// Methode : le VRAI `EventWizardProvider` reste monte pendant toute la marche
// et seul l'ecran affiche change (`arbre.update`). L'etat du tunnel s'accumule
// donc par les VRAIS `dispatch` des ecrans, comme dans l'application. Rien
// n'est reimplemente ici.

/** Proprietes recues par le gabarit d'etape, dans l'ordre du rendu. */
const mockProprietesDuGabarit = [];
/** Le gabarit ne rend son contenu que pour les ecrans pilotes par une carte. */
const mockAffichage = { rendreLeContenu: false };
/** Les donnees servies aux ecrans a la place des appels reseau. */
const mockDonnees = {
  equipes: [
    {
      activities: [{ documentId: 'act-1', name: 'Football' }],
      category: { documentId: 'cat-1', name: 'U15' },
      club: { documentId: 'club-1', name: 'FC Test' },
      documentId: 'equipe-1',
      name: 'U15 A',
      section: { documentId: 'sec-1', name: 'Masculin' },
      sport: { documentId: 'sport-1', name: 'Football' },
    },
  ],
  types: [
    { documentId: 'type-match', name: 'Match' },
    { documentId: 'type-entrainement', name: 'Entrainement' },
    { documentId: 'type-detection', name: 'Detection' },
    { documentId: 'type-stage', name: 'Stage' },
    { documentId: 'type-tournoi', name: 'Tournoi' },
    // Ajoute par D58 : le filet « un test par type » avait un trou, « Autre »
    // n'etait traverse par aucun parcours.
    { documentId: 'type-autre', name: 'Autre' },
  ],
};

const NOM_DE_L_EQUIPE = mockDonnees.equipes[0].name;

jest.mock('react-i18next', () => ({
  // `EventWizardAccess` tire `@/domains/event/eventUseCases`, qui charge
  // `@/theme/strings` et appelle `i18n.use(initReactI18next)` au chargement :
  // sans ce greffon, i18next refuse un module indefini et la suite meurt avant
  // le premier test.
  initReactI18next: { init: () => {}, type: '3rdParty' },
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => {
      if (typeof repli === 'string') return repli;
      if (repli && typeof repli.defaultValue === 'string') return repli.defaultValue;
      return cle;
    },
  }),
}));

// Le VRAI theme, sans le contexte React qui le porte. Un mock en Proxy rend les
// echecs Jest illisibles (constat du lot paywall, 02/08) : on assemble donc les
// vrais modules. `Images` est le seul element stube — le tunnel n'utilise
// qu'une seule entree d'image.
jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const genererStyles = jest.requireActual('@/theme/applicationStyle').default;
  const alignements = jest.requireActual('@/theme/alignements').default;
  const espaces = jest.requireActual('@/theme/spaces').default;
  const couleurs = genererCouleurs();

  return {
    __esModule: true,
    default: () => ({
      Alignments: alignements,
      ApplicationStyle: genererStyles(couleurs),
      Colors: couleurs,
      Fonts: genererPolices(couleurs),
      Images: { chevronDown: 1 },
      Spaces: espaces,
    }),
  };
});

// Le gabarit d'etape est la piece par laquelle chaque ecran expose son
// « Suivant ». On enregistre ses proprietes (dont `onNext`, `stepIndex` et
// `stepCount`) et on ne rend le contenu que pour les deux ecrans dont
// l'avancement passe par une carte a presser (Type et Equipe). Ailleurs, ne pas
// rendre le contenu evite de monter une trentaine de composants hors sujet.
jest.mock('@/components/molecules/wizardStepLayout/WizardStepLayout', () => function GabaritMock(
  /** @type {any} */ props,
) {
  mockProprietesDuGabarit.push(props);
  return mockAffichage.rendreLeContenu ? props.children : null;
});

// `useAuth` rend un objet qui porte AUSSI la table des roles : la resoudre par
// le vrai module evite de figer ici des libelles qui vivent ailleurs.
jest.mock('@/domains/auth/useAuth', () => {
  const { USER_ROLES } = jest.requireActual('@/domains/auth/authUseCases');
  return {
    __esModule: true,
    default: () => ({
      USER_ROLES,
      userData: {
        documentId: 'moi',
        role: { name: USER_ROLES.president, type: 'president' },
      },
    }),
  };
});

// Le Recap tire six dependances de plus que les autres ecrans. On les remplace
// pour pouvoir le RENDRE : c'est la seule facon de prouver que son lien
// « Modifier » mene bien aux invitations.
// AC04 — deux etapes lisent desormais le serveur : « Contre qui ? » cherche des
// clubs (`useSearchClubs`) et « Participants » rappelle l'effectif de l'equipe
// (`useGetTeam`). Ce fichier mesure la CHAINE, pas les donnees : la doublure
// rend donc « rien trouve », ce qui laisse les deux ecrans identiques a
// eux-memes.
// Q2 (23/08) — `prefetchQuery` AJOUTE : l'etape « Equipe organisatrice »
// precharge desormais l'effectif au toucher, et ce fichier traverse un tunnel
// MATCH en tapant une equipe. Sans cette ligne, le toucher jetterait un
// TypeError au milieu de la chaine.
jest.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: undefined, isLoading: false }),
  useQueryClient: () => ({
    invalidateQueries: () => {},
    prefetchQuery: () => Promise.resolve(),
  }),
}));

jest.mock('@/domains/event/useEvent', () => ({
  __esModule: true,
  default: () => ({
    createReccurrentEventPayload: () => [],
    createStageEventPayload: () => ({}),
  }),
}));

jest.mock('@/services/celebrations/celebrationRuntime', () => ({ celebrate: () => {} }));

jest.mock('@/services/event/eventService', () => ({
  createEventsWithConcurrency: () => Promise.resolve([]),
  getEventById: () => Promise.resolve(null),
  requestFeatured: () => Promise.resolve(null),
}));

jest.mock('../../components/EventTasksEditor', () => () => null);

jest.mock('@/domains/places/usePlaces', () => ({
  __esModule: true,
  default: () => ({ places: [], searchPlaces: () => {} }),
}));

// ⛔ Jamais `requireActual` sur un service : le client HTTP exige `API_URL` et
// la suite entiere meurt au chargement.
// Q2 (23/08) — `getTeamById` AJOUTE : l'etape « Equipe organisatrice » l'importe
// pour precharger l'effectif. Sans lui dans la doublure, l'import chargerait le
// vrai client HTTP et la suite entiere mourrait au chargement.
jest.mock('@/services/team/teamService', () => ({
  getTeamById: () => Promise.resolve(null),
  getTeams: () => Promise.resolve([]),
}));

// W07 — `EventWizardInvites` cherche desormais les clubs externes par la
// recherche serveur `getClubs`. Comme `teamService` juste au-dessus, ce service
// est double : sans lui, son `client` reclamerait une API_URL au chargement du
// module et la suite entiere refuserait de demarrer.
jest.mock('@/services/club/clubService', () => ({
  getClubs: () => Promise.resolve({
    data: [],
    meta: {
      pagination: {
        page: 1, pageCount: 0, pageSize: 10, total: 0,
      },
    },
  }),
}));

jest.mock('@/services/event/eventQueries', () => ({
  useGetEventTypes: () => ({
    data: mockDonnees.types, error: null, isLoading: false, refetch: () => {},
  }),
}));

// `useGetTeams` est une requete PAGINEE : l'ecran lit `data.pages[].data[]`.
// Rendre le tableau d'equipes directement donne une liste VIDE sans la moindre
// erreur — l'ecran affiche alors « Créer une équipe » et le tunnel s'arrete.
jest.mock('@/services/team/teamQueries', () => ({
  // AC04 — l'effectif complet, rappele par l'etape Participants pour porter la
  // convocation d'un match. Vide ici : ce fichier mesure la CHAINE.
  useGetTeam: () => ({ data: undefined, isLoading: false }),
  useGetTeams: () => ({
    data: { pages: [{ data: mockDonnees.equipes }] },
    error: null,
    isLoading: false,
    refetch: () => {},
  }),
}));

jest.mock('@/services/activity/activityQueries', () => ({
  useGetActivities: () => ({ data: [], error: null, isLoading: false }),
}));

jest.mock('@/services/category/categoryQueries', () => ({
  useGetCategories: () => ({ data: [], error: null, isLoading: false }),
}));

jest.mock('@/services/section/sectionQueries', () => ({
  useGetSections: () => ({ data: [], error: null, isLoading: false }),
}));

// Passe-plats : ces pieces ont leur propre filet et tireraient ici des
// dependances hors sujet (tour guide, quotas d'abonnement).
jest.mock('@/components/molecules/tutorial/TutorialFlowBoundary', () => function BorneMock(
  /** @type {any} */ props,
) {
  return props.children;
});

jest.mock(
  '@/components/molecules/onboardingWrapper/OnboardingWrapper',
  () => function EnveloppeMock(/** @type {any} */ props) {
    return props.children;
  },
);

jest.mock(
  '@/components/molecules/subscriptionQuotaBanner/SubscriptionQuotaBanner',
  () => function BandeauMock() {
    return null;
  },
);

// La carte d'equipe est rendue comme un pressable portant le nom de l'equipe :
// c'est ce qui permet d'appuyer « sur le texte » plutot que sur une forme
// d'arbre, et de survivre a une refonte de la carte (lots D09 et D10).
jest.mock('@/views/event/wizard/components/EventWizardTeamCard', () => function CarteEquipeMock(
  /** @type {any} */ props,
) {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return reactActuel.createElement(
    PressableRN,
    { accessibilityRole: 'button', onPress: props.onPress },
    reactActuel.createElement(TexteRN, null, props.team?.name),
  );
});

// Les pieces de saisie et les organismes du tunnel : remplaces par du vide. Ce
// filet decrit la MACHINE (quel ecran mene ou), pas le contenu des ecrans — et
// plusieurs de ces pieces tirent des modules natifs qu'un test ne charge pas
// (feuille du bas, curseur, gestes, case a cocher animee).
// ⚠️ Ces appels doivent rester DEPLIES un par un, avec une fabrique ECRITE SUR
// PLACE : `jest.mock` dans une boucle n'est pas remonte au-dessus des imports,
// et une fabrique passee par variable est refusee par Babel.
jest.mock('@/components/atoms/checkbox/Checkbox', () => () => null);
jest.mock('@/components/molecules/autocompleteSelect/AutocompleteSelect', () => () => null);
jest.mock('@/components/molecules/bottomModal/BottomModal', () => () => null);
jest.mock('@/components/molecules/clubSearchResultCard/ClubSearchResultCard', () => () => null);
jest.mock('@/components/molecules/datePickerInput/DatePickerInput', () => () => null);
jest.mock('@/components/molecules/dateTimeSelector/DateTimeSelector', () => () => null);
jest.mock('@/components/molecules/dayPicker/DayPicker', () => () => null);
jest.mock('@/components/molecules/input/Input', () => () => null);
jest.mock('@/components/molecules/profileAvatar/ProfileAvatar', () => () => null);
jest.mock('@/components/molecules/searchBar/SearchBar', () => () => null);
jest.mock('@/components/molecules/segmentedControl/SegmentedControl', () => () => null);
jest.mock(
  '@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet',
  () => () => null,
);
jest.mock('@/components/molecules/timePickerInput/TimePickerInput', () => () => null);
jest.mock(
  '@/components/organisms/autocompleteAddressInput/autocompleteAddressInput',
  () => () => null,
);
jest.mock('@/components/organisms/facilitySelector/FacilitySelector', () => () => null);
jest.mock('@/components/organisms/positionSelectionList/PositionSelectionList', () => () => null);
jest.mock('@react-native-community/slider', () => () => null);

jest.mock('@/components/atoms/button/Button', () => function BoutonMock(/** @type {any} */ props) {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return reactActuel.createElement(
    PressableRN,
    { accessibilityRole: 'button', disabled: Boolean(props.disabled), onPress: props.onPress },
    reactActuel.createElement(TexteRN, null, props.title),
  );
});

const ECRANS = {
  [RouteNames.EventWizardAccess]: EventWizardAccess,
  [RouteNames.EventWizardDescription]: EventWizardDescription,
  [RouteNames.EventWizardInvites]: EventWizardInvites,
  [RouteNames.EventWizardLocation]: EventWizardLocation,
  [RouteNames.EventWizardLogistics]: EventWizardLogistics,
  [RouteNames.EventWizardOpponent]: EventWizardOpponent,
  [RouteNames.EventWizardParticipants]: EventWizardParticipants,
  [RouteNames.EventWizardRecap]: EventWizardRecap,
  [RouteNames.EventWizardStageProgram]: EventWizardStageProgram,
  [RouteNames.EventWizardTeam]: EventWizardTeam,
  [RouteNames.EventWizardTournamentSettings]: EventWizardTournamentSettings,
  [RouteNames.EventWizardTournamentStructure]: EventWizardTournamentStructure,
  [RouteNames.EventWizardType]: EventWizardType,
};

/** Les deux ecrans dont l'avancement passe par une carte a presser. */
const ECRANS_A_CARTES = new Set([RouteNames.EventWizardTeam, RouteNames.EventWizardType]);

/** Le dispatch du tunnel, capte pour semer l'etat de depart d'un parcours. */
let semer = () => {};

/**
 * Composant sans rendu, monte a cote de l'ecran : il capte le `dispatch` du
 * tunnel pour que le test puisse semer un etat de depart.
 * @returns {null}
 */
function PriseDeCourant() {
  const { dispatch } = useEventWizard();
  semer = dispatch;
  return null;
}

/**
 * Tous les textes rendus sous un noeud de l'arbre de test.
 * @param {any} noeud
 * @returns {string[]}
 */
const textesSous = (noeud) => {
  /** @type {string[]} */
  const sortie = [];
  const parcourir = (/** @type {any} */ enfant) => {
    if (typeof enfant === 'string' || typeof enfant === 'number') {
      sortie.push(String(enfant));
      return;
    }
    if (Array.isArray(enfant)) {
      enfant.forEach(parcourir);
      return;
    }
    if (enfant?.children) enfant.children.forEach(parcourir);
  };
  parcourir(noeud.children);
  return sortie;
};

/**
 * Marche dans le tunnel en appuyant toujours sur « Suivant ».
 * @param {object} options
 * @param {string} options.nomDuType Nom du type d'evenement choisi sur le 1er ecran.
 * @param {(dispatch: any) => void} [options.avantDeMarcher] Etat seme apres le choix du type.
 * @returns {{ chaine: string[], comptes: Record<string, number>,
 *   positions: Record<string, number> }} La marche relevee.
 */
const marcherDansLeTunnel = ({ avantDeMarcher, nomDuType }) => {
  /** @type {string[]} */
  const chaine = [RouteNames.EventWizardType];
  /** @type {Record<string, number>} */
  const positions = {};
  /** @type {Record<string, number>} */
  const comptes = {};
  /** @type {string[]} */
  const destinations = [];
  let routeCourante = RouteNames.EventWizardType;

  const navigation = {
    goBack: () => {},
    navigate: (/** @type {string} */ nom) => destinations.push(nom),
    // D19 — le Recap ouvre desormais ses etapes avec `push` (il EMPILE
    // au-dessus de lui au lieu d'y retourner en depilant). Ce filet mesure les
    // ecrans JOIGNABLES, pas le verbe employe : la doublure enregistre donc les
    // trois verbes de la meme facon.
    push: (/** @type {string} */ nom) => destinations.push(nom),
    replace: (/** @type {string} */ nom) => destinations.push(nom),
    setParams: () => {},
  };

  const elementDeLEcran = (/** @type {string} */ route) => createElement(
    EventWizardProvider,
    null,
    createElement(PriseDeCourant),
    createElement(ECRANS[route], { navigation, route: { params: {} } }),
  );

  /**
   * Presse le premier pressable dont le texte visible vaut `libelle`.
   * On cherche « ce qui porte un onPress » plutot qu'un type de composant : la
   * cible survit ainsi a un changement de pressable (lots D09 et D10).
   * @param {any} arbreRendu Arbre de test courant.
   * @param {string} libelle Texte visible du pressable a actionner.
   */
  const presserLeTexte = (arbreRendu, libelle) => {
    const pressables = arbreRendu.root.findAll(
      (/** @type {any} */ noeud) => typeof noeud.props?.onPress === 'function',
      { deep: true },
    );
    const cible = pressables.find((noeud) => textesSous(noeud).includes(libelle));
    if (!cible) {
      const vus = pressables.map((noeud) => textesSous(noeud).join('|')).filter(Boolean);
      throw new Error(
        `aucun pressable ne porte le texte « ${libelle} ». Pressables vus : ${JSON.stringify(vus)}`,
      );
    }
    act(() => cible.props.onPress());
  };

  /** @type {any} */
  let arbre;

  /**
   * Affiche un ecran du tunnel dans le meme fournisseur d'etat.
   * @param {string} route Nom de la route a afficher.
   */
  const afficher = (route) => {
    mockAffichage.rendreLeContenu = ECRANS_A_CARTES.has(route);
    mockProprietesDuGabarit.length = 0;
    if (arbre) act(() => arbre.update(elementDeLEcran(route)));
    else act(() => { arbre = renderer.create(elementDeLEcran(route)); });
  };

  /** Sème l'etat de depart du parcours, juste apres le choix du type. */
  const semerLEtatDeDepart = () => {
    if (avantDeMarcher) act(() => avantDeMarcher(semer));
  };

  /**
   * Appuie sur le « Suivant » du gabarit d'etape.
   * @param {any} gabarit Proprietes relevees du gabarit courant.
   * @returns {any} Le resultat de `act`, ignore par l'appelant.
   */
  const appuyerSurSuivant = (gabarit) => act(() => gabarit.onNext());

  afficher(routeCourante);

  for (let pas = 0; pas < 15; pas += 1) {
    const gabarit = mockProprietesDuGabarit[mockProprietesDuGabarit.length - 1];
    if (!gabarit) throw new Error(`${routeCourante} n'a pas rendu de gabarit d'etape`);
    positions[routeCourante] = gabarit.stepIndex;
    comptes[routeCourante] = gabarit.stepCount;

    destinations.length = 0;

    if (routeCourante === RouteNames.EventWizardType) {
      presserLeTexte(arbre, nomDuType);
      semerLEtatDeDepart();
    } else if (routeCourante === RouteNames.EventWizardTeam) {
      presserLeTexte(arbre, NOM_DE_L_EQUIPE);
    } else {
      appuyerSurSuivant(gabarit);
    }

    if (destinations.length === 0) throw new Error(`${routeCourante} n'a navigue nulle part`);
    const [suivant] = destinations;
    chaine.push(suivant);
    routeCourante = suivant;

    if (routeCourante === RouteNames.EventWizardRecap) break;

    afficher(routeCourante);
  }

  act(() => arbre.unmount());
  return { chaine, comptes, positions };
};

/**
 * Le nombre d'etapes annonce par le DERNIER ecran traverse, une fois l'etat du
 * tunnel complet. Le Recap n'etant pas rendu ici, c'est l'avant-dernier maillon.
 * @param {any} marche Resultat de `marcherDansLeTunnel`.
 * @returns {number} Nombre d'etapes annonce en fin de parcours.
 */
const totalAnnonceALaFin = (marche) => marche.comptes[
  marche.chaine[marche.chaine.length - 2]
];

/**
 * Rend le Recap, presse TOUT ce qui s'y presse, et rend les destinations
 * relevees. Ce qui compte ici est l'ensemble des ecrans JOIGNABLES depuis le
 * Recap, pas la forme des liens qui y menent.
 *
 * ⚠️ Elargi par le lot D10 : cette fonction ne retenait que les pressables
 * portant le texte « Modifier ». Le repli en « Options avancees » a transforme
 * le lien vers les invitations en une RANGEE (libelle + valeur + chevron), qui
 * ne porte plus ce mot — le test rougissait alors que l'ecran restait
 * parfaitement atteignable. Viser le libelle, c'etait viser la peinture.
 * @returns {string[]} Les routes joignables depuis le Recap.
 */
const destinationsDesLiensModifier = () => {
  /** @type {string[]} */
  const destinations = [];
  const navigation = {
    goBack: () => {},
    navigate: (/** @type {string} */ nom) => destinations.push(nom),
    // D19 — le Recap ouvre desormais ses etapes avec `push` (il EMPILE
    // au-dessus de lui au lieu d'y retourner en depilant). Ce filet mesure les
    // ecrans JOIGNABLES, pas le verbe employe : la doublure enregistre donc les
    // trois verbes de la meme facon.
    push: (/** @type {string} */ nom) => destinations.push(nom),
    replace: (/** @type {string} */ nom) => destinations.push(nom),
    setParams: () => {},
  };

  mockAffichage.rendreLeContenu = true;
  mockProprietesDuGabarit.length = 0;

  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(createElement(
      EventWizardProvider,
      null,
      createElement(EventWizardRecap, { navigation, route: { params: {} } }),
    ));
  });

  const liens = arbre.root.findAll(
    (/** @type {any} */ noeud) => typeof noeud.props?.onPress === 'function',
    { deep: true },
  );

  expect(liens.length).toBeGreaterThan(0);
  liens.forEach((/** @type {any} */ lien) => act(() => lien.props.onPress()));
  act(() => arbre.unmount());

  return destinations;
};

describe('D08 — la chaine reelle du tunnel, type par type', () => {
  // 🔒 AA10 ③ — 8 → 7 ECRANS, et c'est une CONSEQUENCE, pas un but : un
  // entrainement naît desormais PRIVE, et la regle de D08
  // (`shouldSkipEventWizardParticipantsStep`) saute l'etape Participants d'un
  // entrainement prive. Le temoin juste en dessous garde l'autre moitie : repasse
  // en Public, l'entrainement retrouve son etape.
  test('evenement standard : 7 ecrans, prive par defaut depuis AA10', () => {
    // Y02 : le representant du parcours « standard » n'est plus le match — il a
    // desormais une etape de plus. Le test qui suit couvre le match a part.
    const marche = marcherDansLeTunnel({ nomDuType: 'Entrainement' });
    const { chaine } = marche;

    expect(chaine).toEqual([
      RouteNames.EventWizardType,
      RouteNames.EventWizardTeam,
      RouteNames.EventWizardLogistics,
      RouteNames.EventWizardLocation,
      RouteNames.EventWizardAccess,
      RouteNames.EventWizardDescription,
      RouteNames.EventWizardRecap,
    ]);
    expect(chaine).not.toContain(RouteNames.EventWizardInvites);
    expect(chaine).not.toContain(RouteNames.EventWizardOpponent);
    expect(totalAnnonceALaFin(marche)).toBe(7);
  });

  // 🎯 Y02 — le parcours qui change de forme, marche pour de vrai.
  test('match : 10 ecrans — « Contre qui ? » puis « Invitations »', () => {
    const marche = marcherDansLeTunnel({ nomDuType: 'Match' });
    const { chaine } = marche;

    expect(chaine).toEqual([
      RouteNames.EventWizardType,
      RouteNames.EventWizardTeam,
      RouteNames.EventWizardLogistics,
      RouteNames.EventWizardOpponent,
      RouteNames.EventWizardLocation,
      RouteNames.EventWizardParticipants,
      // AA10 ② — les invitations sont entrees dans la chaine, pour le match seul.
      RouteNames.EventWizardInvites,
      RouteNames.EventWizardAccess,
      RouteNames.EventWizardDescription,
      RouteNames.EventWizardRecap,
    ]);
    expect(totalAnnonceALaFin(marche)).toBe(10);
  });

  test('stage : 8 ecrans, et il GARDE son programme de stage', () => {
    const marche = marcherDansLeTunnel({ nomDuType: 'Stage' });
    const { chaine } = marche;

    expect(chaine).toEqual([
      RouteNames.EventWizardType,
      RouteNames.EventWizardTeam,
      RouteNames.EventWizardStageProgram,
      RouteNames.EventWizardLocation,
      RouteNames.EventWizardParticipants,
      RouteNames.EventWizardAccess,
      RouteNames.EventWizardDescription,
      RouteNames.EventWizardRecap,
    ]);
    expect(totalAnnonceALaFin(marche)).toBe(8);
  });

  test('tournoi : 10 ecrans, il GARDE ses deux ecrans de tournoi', () => {
    const marche = marcherDansLeTunnel({ nomDuType: 'Tournoi' });
    const { chaine } = marche;

    expect(chaine).toEqual([
      RouteNames.EventWizardType,
      RouteNames.EventWizardTeam,
      RouteNames.EventWizardLogistics,
      RouteNames.EventWizardLocation,
      RouteNames.EventWizardTournamentSettings,
      RouteNames.EventWizardTournamentStructure,
      RouteNames.EventWizardParticipants,
      // L'ecran « Acces » du tournoi ne montre QUE la visibilite : sa validation
      // est deduite du mode d'inscription (EventWizardTournamentSettings.js:99),
      // exactement comme avant D08.
      RouteNames.EventWizardAccess,
      RouteNames.EventWizardDescription,
      RouteNames.EventWizardRecap,
    ]);
    expect(totalAnnonceALaFin(marche)).toBe(10);
  });

  test('detection sur un sport a postes : 8 ecrans, postes fondus dans Participants', () => {
    // D58 (2026-08-10) — avant la fusion ce parcours en comptait 9 :
    // `EventWizardDetectionSlots` s'inserait apres Participants. Les postes
    // recherches sont desormais une SECTION de Participants, derriere un
    // interrupteur, et la detection rejoint les 8 etapes promises par le pack.
    const marche = marcherDansLeTunnel({ nomDuType: 'Detection' });
    const { chaine } = marche;

    expect(chaine).toEqual([
      RouteNames.EventWizardType,
      RouteNames.EventWizardTeam,
      RouteNames.EventWizardLogistics,
      RouteNames.EventWizardLocation,
      RouteNames.EventWizardParticipants,
      RouteNames.EventWizardAccess,
      RouteNames.EventWizardDescription,
      RouteNames.EventWizardRecap,
    ]);
    expect(totalAnnonceALaFin(marche)).toBe(8);
  });

  test('entrainement prive : l ecran Participants est saute', () => {
    const { chaine } = marcherDansLeTunnel({
      avantDeMarcher: (dispatch) => dispatch({
        payload: { sessionStatus: 'closed' },
        type: 'SET_META',
      }),
      nomDuType: 'Entrainement',
    });

    // Le lieu envoie directement sur l'acces : Participants n'est pas traverse.
    expect(chaine).toEqual([
      RouteNames.EventWizardType,
      RouteNames.EventWizardTeam,
      RouteNames.EventWizardLogistics,
      RouteNames.EventWizardLocation,
      RouteNames.EventWizardAccess,
      RouteNames.EventWizardDescription,
      RouteNames.EventWizardRecap,
    ]);
    expect(chaine).not.toContain(RouteNames.EventWizardParticipants);
  });
});

// ---------------------------------------------------------------------------
// FILET D58 (E6) — moitie TRANSITIONS du « un test par type d evenement ».
//
// Le tableau des NUMEROS vit dans `eventWizardDetectionUtils.test.js`. Ici on
// MARCHE vraiment dans le tunnel, type par type, et on releve le nombre
// d'etapes annonce a l'ecran. Deux parcours n'etaient traverses par aucun test
// avant ce lot : l'entrainement OUVERT (seul son jumeau prive l'etait) et
// « Autre ». Mesure du 2026-08-10, avant la fusion des postes recherches.
// ---------------------------------------------------------------------------
describe('D58 — chaque type traverse son parcours, et annonce son compte', () => {
  test.each([
    // AA10 : le match gagne « Invitations » (9 → 10), l'entrainement perd
    // « Participants » parce qu'il naît prive (8 → 7).
    ['Match', 10],
    ['Entrainement', 7],
    ['Stage', 8],
    ['Tournoi', 10],
    ['Autre', 8],
  ])('un parcours %s annonce %i etapes de bout en bout', (nomDuType, attendu) => {
    const marche = marcherDansLeTunnel({ nomDuType });

    expect(totalAnnonceALaFin(marche)).toBe(attendu);
    expect(marche.chaine[marche.chaine.length - 1]).toBe(RouteNames.EventWizardRecap);
  });

  test('un entrainement OUVERT garde son etape Participants', () => {
    // Son jumeau ferme la saute (`shouldSkipEventWizardParticipantsStep`) : sans
    // ce cas, rien ne distinguait « saute a bon escient » de « saute toujours ».
    // 🔒 AA10 : depuis que le defaut est PRIVE, c'est ce parcours-la qui doit
    // etre seme a la main. C'est aussi le temoin qui prouve que l'etape n'a pas
    // ete supprimee — seulement sautee quand elle n'a rien a demander.
    const { chaine } = marcherDansLeTunnel({
      avantDeMarcher: (dispatch) => dispatch({
        payload: { sessionStatus: 'open' },
        type: 'SET_META',
      }),
      nomDuType: 'Entrainement',
    });

    expect(chaine).toContain(RouteNames.EventWizardParticipants);
  });

  test('« Autre » suit exactement le parcours d un evenement standard', () => {
    expect(marcherDansLeTunnel({ nomDuType: 'Autre' }).chaine).toEqual([
      RouteNames.EventWizardType,
      RouteNames.EventWizardTeam,
      RouteNames.EventWizardLogistics,
      RouteNames.EventWizardLocation,
      RouteNames.EventWizardParticipants,
      RouteNames.EventWizardAccess,
      RouteNames.EventWizardDescription,
      RouteNames.EventWizardRecap,
    ]);
  });
});

describe('D08 — le compteur du 1er ecran est calcule AVANT le choix du type', () => {
  // Bizarrerie mesuree le 2026-08-06, figee telle quelle : `EventWizardType`
  // calcule `stepCount` sur un etat dont `type` est encore nul. Il annonce donc
  // « 1/10 » meme quand le parcours choisi juste apres en compte 9 ou 11. Le
  // compte ne devient juste qu'a partir de l'ecran suivant.
  test.each([
    ['Tournoi', 10],
    // D58 — la detection ne fait plus mentir le 1er ecran : il annonce 8, et le
    // parcours en compte bien 8. Le tournoi reste le seul ecart.
    ['Detection', 8],
  ])('parcours %s : le 1er ecran dit 8, la fin dit %i', (nomDuType, reel) => {
    const marche = marcherDansLeTunnel({ nomDuType });

    expect(marche.comptes[RouteNames.EventWizardType]).toBe(8);
    expect(totalAnnonceALaFin(marche)).toBe(reel);
  });

  test('des le 2e ecran, le compte annonce est le bon', () => {
    const marche = marcherDansLeTunnel({ nomDuType: 'Tournoi' });

    expect(marche.comptes[RouteNames.EventWizardTeam]).toBe(10);
  });
});

describe('D08 — les ecrans hors chemin standard restent ATTEIGNABLES', () => {
  test.each([
    ['Stage', RouteNames.EventWizardStageProgram],
    ['Tournoi', RouteNames.EventWizardTournamentSettings],
    ['Tournoi', RouteNames.EventWizardTournamentStructure],
  ])('un parcours %s traverse %s', (nomDuType, ecran) => {
    expect(marcherDansLeTunnel({ nomDuType }).chaine).toContain(ecran);
  });

  test('le Recap mene aux invitations — le seul chemin hors match', () => {
    // D08 a sorti `EventWizardInvites` de la chaine. Si ce lien disparait,
    // l'ecran (1 474 lignes) devient injoignable pour tous les types SAUF le
    // match, ou AA10 en a refait une etape : c'est exactement la pire
    // regression du projet, du code que plus rien n'atteint.
    expect(destinationsDesLiensModifier()).toContain(RouteNames.EventWizardInvites);
  });

  test('le Recap ne pointe plus vers les deux ecrans fusionnes', () => {
    const destinations = destinationsDesLiensModifier();

    expect(destinations).not.toContain('EventWizardVisibility');
    expect(destinations).not.toContain('EventWizardValidationMode');
  });
});

describe('D08 — les positions annoncees a l ecran suivent la chaine reelle', () => {
  test.each([
    ['Match', 10],
    ['Stage', 8],
    ['Tournoi', 10],
    ['Detection', 8],
  ])('parcours %s : chaque ecran annonce sa place sur %i', (nomDuType, attendu) => {
    const marche = marcherDansLeTunnel({ nomDuType });
    const { chaine, positions } = marche;

    expect(totalAnnonceALaFin(marche)).toBe(attendu);
    chaine.forEach((route, rang) => {
      if (positions[route] === undefined) return;
      // Les index affiches sont 1-bases : le 1er ecran annonce 1. On compare
      // sous forme de chaine pour que l'echec nomme l'ecran fautif.
      expect(`${route}=${positions[route]}`).toBe(`${route}=${rang + 1}`);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// D19 — « MODIFIER » DEPUIS LE RECAPITULATIF DOIT RAMENER AU RECAPITULATIF
//
// Defaut trouve a la recette du 2026-08-07 : depuis le recapitulatif,
// « modifier » ouvrait bien la bonne etape, mais une fois la correction faite il
// fallait RETRAVERSER toutes les etapes suivantes. Le filet D08 ci-dessus ne
// pouvait pas le voir : il ne marche que dans le sens du tunnel, jamais depuis
// le recap.
//
// Les deux temoins du lot vivent ici, et ils sont indissociables :
//   ① depuis le recap, l'etape N ramene AU RECAP ;
//   ② en tunnel normal, l'etape N mene TOUJOURS a N+1 — le comportement
//      d'aujourd'hui, fige pour que la correction ne le deplace pas.
// ═══════════════════════════════════════════════════════════════════════════

const TYPE_MATCH = { documentId: 'type-match', name: 'Match' };
const TYPE_TOURNOI = { documentId: 'type-tournoi', name: 'Tournoi' };
const TYPE_DETECTION = { documentId: 'type-detection', name: 'Detection' };
const EQUIPE_A_POSTES = mockDonnees.equipes[0];

/**
 * Ouvre UNE etape seule, appuie sur son « Suivant », et rend la destination.
 * @param {object} options Parametres de l'ouverture.
 * @param {boolean} [options.avecBilletDeRetour] L'etape est-elle ouverte depuis le recap ?
 * @param {any} options.etatSeme Etat du tunnel au moment de l'ouverture.
 * @param {string} options.route L'etape a ouvrir.
 * @returns {string} La destination atteinte.
 */
const sortieDeLEtape = ({ avecBilletDeRetour, etatSeme, route }) => {
  /** @type {string[]} */
  const destinations = [];
  const navigation = {
    goBack: () => {},
    navigate: (/** @type {string} */ nom) => destinations.push(nom),
    push: (/** @type {string} */ nom) => destinations.push(nom),
    replace: (/** @type {string} */ nom) => destinations.push(nom),
    setParams: () => {},
  };

  mockAffichage.rendreLeContenu = false;
  mockProprietesDuGabarit.length = 0;

  const rendre = (/** @type {any} */ contenu) => createElement(
    EventWizardProvider,
    null,
    createElement(PriseDeCourant),
    contenu,
  );

  /** @type {any} */
  let arbre;
  // Deux temps, et l'ordre compte : chaque ecran lit l'etat du tunnel dans le
  // `useState` de son PREMIER rendu. Semer apres coup ne changerait rien.
  act(() => { arbre = renderer.create(rendre(null)); });
  act(() => semer({ payload: etatSeme, type: 'SET_META' }));
  act(() => arbre.update(rendre(createElement(ECRANS[route], {
    navigation,
    route: { params: avecBilletDeRetour ? { returnTo: RouteNames.EventWizardRecap } : {} },
  }))));

  const gabarit = mockProprietesDuGabarit[mockProprietesDuGabarit.length - 1];
  if (typeof gabarit?.onNext !== 'function') {
    throw new Error(`${route} n'expose pas de « Suivant »`);
  }
  act(() => gabarit.onNext());
  act(() => arbre.unmount());

  if (destinations.length === 0) throw new Error(`${route} n'a navigue nulle part`);
  return destinations[0];
};

/** Une etape joignable depuis le recap, avec l'etat qui la met dans la chaine. */
const ETAPES_JOIGNABLES_DEPUIS_LE_RECAP = [
  [RouteNames.EventWizardLogistics, { team: EQUIPE_A_POSTES, type: TYPE_MATCH }],
  [RouteNames.EventWizardLocation, { team: EQUIPE_A_POSTES, type: TYPE_MATCH }],
  [RouteNames.EventWizardParticipants, { team: EQUIPE_A_POSTES, type: TYPE_MATCH }],
  [RouteNames.EventWizardAccess, { team: EQUIPE_A_POSTES, type: TYPE_MATCH }],
  [RouteNames.EventWizardDescription, { team: EQUIPE_A_POSTES, type: TYPE_MATCH }],
  [RouteNames.EventWizardTournamentSettings, { team: EQUIPE_A_POSTES, type: TYPE_TOURNOI }],
  [RouteNames.EventWizardTournamentStructure, { team: EQUIPE_A_POSTES, type: TYPE_TOURNOI }],
];

describe('D19 — temoin ① depuis le recap, l etape ramene AU RECAP', () => {
  test.each(ETAPES_JOIGNABLES_DEPUIS_LE_RECAP)(
    '%s ouverte depuis le recap y revient',
    (route, etatSeme) => {
      expect(sortieDeLEtape({ avecBilletDeRetour: true, etatSeme, route }))
        .toBe(RouteNames.EventWizardRecap);
    },
  );
});

describe('D19 — temoin ② en tunnel normal, l etape mene TOUJOURS a la suivante', () => {
  // Le garde-fou du lot : sans le billet de retour, RIEN ne doit changer. La
  // destination attendue n'est pas ecrite en dur — elle est demandee a la chaine
  // elle-meme, la seule source de verite du tunnel depuis D08.
  test.each(ETAPES_JOIGNABLES_DEPUIS_LE_RECAP)(
    '%s ouverte normalement suit la chaine',
    (route, etatSeme) => {
      const attendue = getEventWizardNextRoute(route, etatSeme);

      expect(sortieDeLEtape({ avecBilletDeRetour: false, etatSeme, route })).toBe(attendue);
    },
  );

  // ⚠️ Ce que le temoin ② ne peut pas distinguer, et il faut le dire :
  // `EventWizardDescription` est la DERNIERE etape avant le recap. Sa
  // destination normale EST le recap, avec ou sans billet. Le cas reste dans le
  // tableau pour ne pas etre oublie, mais c'est le balayage de la regle pure
  // ci-dessous qui le couvre vraiment.
  test('la description mene au recap dans les deux cas — cas indistinguable, assume', () => {
    const etatSeme = { team: EQUIPE_A_POSTES, type: TYPE_MATCH };

    expect(getEventWizardNextRoute(RouteNames.EventWizardDescription, etatSeme))
      .toBe(RouteNames.EventWizardRecap);
  });
});

describe('D19 — la regle de retour, prise a part', () => {
  // La regle est une fonction pure : on peut donc la balayer sur TOUTES les
  // etapes du tunnel, y compris celles que les tests montes ci-dessus ne
  // savent pas piloter (le programme de stage exige des journees saisies).
  const TOUTES_LES_ETAPES = getEventWizardStepRoutes({
    team: EQUIPE_A_POSTES,
    type: TYPE_TOURNOI,
  }).concat(RouteNames.EventWizardStageProgram);

  test('avec le billet, toute etape ramene au recap', () => {
    TOUTES_LES_ETAPES.forEach((route) => {
      const suivante = getEventWizardNextRoute(route, { type: TYPE_TOURNOI });
      const atteinte = getEventWizardExitRoute(
        suivante,
        { returnTo: RouteNames.EventWizardRecap },
      );

      expect(`${route} -> ${atteinte}`).toBe(`${route} -> ${RouteNames.EventWizardRecap}`);
    });
  });

  test('sans le billet, elle rend EXACTEMENT la destination qu on lui passe', () => {
    TOUTES_LES_ETAPES.forEach((route) => {
      const suivante = getEventWizardNextRoute(route, { type: TYPE_TOURNOI });

      expect(`${route} -> ${getEventWizardExitRoute(suivante, {})}`)
        .toBe(`${route} -> ${suivante}`);
      expect(getEventWizardExitRoute(suivante, undefined)).toBe(suivante);
    });
  });

  // ⛔ Le billet ne s'invente pas : un parametre etranger ne doit pas detourner
  // le tunnel. C'est ce qui empeche une URL bricolee de couper des etapes sur
  // le site.
  test('un parametre etranger ne detourne rien', () => {
    expect(getEventWizardExitRoute(RouteNames.EventWizardLocation, { returnTo: 'AutreEcran' }))
      .toBe(RouteNames.EventWizardLocation);
    expect(getEventWizardExitRoute(RouteNames.EventWizardLocation, { startTutorial: true }))
      .toBe(RouteNames.EventWizardLocation);
  });
});

describe('D19 — le premier ecran est le SEUL a poser une condition', () => {
  /**
   * Choisit un type sur le 1er ecran, ouvert depuis le recap, et rend la
   * destination atteinte.
   * @param {object} options Parametres du choix.
   * @param {string} options.typeChoisi Le nom du type sur lequel on appuie.
   * @param {any} options.typeDeja Le type deja enregistre dans le tunnel.
   * @returns {string} La destination atteinte.
   */
  const choisirUnType = ({ typeChoisi, typeDeja }) => {
    /** @type {string[]} */
    const destinations = [];
    const navigation = {
      goBack: () => {},
      navigate: (/** @type {string} */ nom) => destinations.push(nom),
      push: (/** @type {string} */ nom) => destinations.push(nom),
      replace: (/** @type {string} */ nom) => destinations.push(nom),
      setParams: () => {},
    };

    mockAffichage.rendreLeContenu = true;
    mockProprietesDuGabarit.length = 0;

    const rendre = (/** @type {any} */ contenu) => createElement(
      EventWizardProvider,
      null,
      createElement(PriseDeCourant),
      contenu,
    );

    /** @type {any} */
    let arbre;
    act(() => { arbre = renderer.create(rendre(null)); });
    act(() => semer({ payload: { team: EQUIPE_A_POSTES, type: typeDeja }, type: 'SET_META' }));
    act(() => arbre.update(rendre(createElement(ECRANS[RouteNames.EventWizardType], {
      navigation,
      route: { params: { returnTo: RouteNames.EventWizardRecap } },
    }))));

    const pressables = arbre.root.findAll(
      (/** @type {any} */ noeud) => typeof noeud.props?.onPress === 'function',
      { deep: true },
    );
    const cible = pressables.find((noeud) => textesSous(noeud).includes(typeChoisi));
    if (!cible) throw new Error(`aucune rangee « ${typeChoisi} »`);
    act(() => cible.props.onPress());
    act(() => arbre.unmount());

    return destinations[0];
  };

  test('reappuyer sur le MEME type est un geste blanc : on rend la main au recap', () => {
    expect(choisirUnType({ typeChoisi: 'Match', typeDeja: TYPE_MATCH }))
      .toBe(RouteNames.EventWizardRecap);
  });

  // Le cas limite qui justifie la condition : changer le type change la CHAINE
  // (un stage gagne son programme, une detection ses postes). Revenir droit au
  // recap laisserait ces etapes-la jamais remplies.
  test('CHANGER de type repart dans le tunnel, meme ouvert depuis le recap', () => {
    expect(choisirUnType({ typeChoisi: 'Tournoi', typeDeja: TYPE_MATCH }))
      .toBe(RouteNames.EventWizardTeam);
  });
});
