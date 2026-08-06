import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import { RouteNames } from '@/navigation/routeNames';

import EventWizardAccess from '../EventWizardAccess';
import { EventWizardProvider, useEventWizard } from '../EventWizardContext';
import EventWizardDescription from '../EventWizardDescription';
import EventWizardDetectionSlots from '../EventWizardDetectionSlots';
import EventWizardInvites from '../EventWizardInvites';
import EventWizardLocation from '../EventWizardLocation';
import EventWizardLogistics from '../EventWizardLogistics';
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
jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries: () => {} }) }));

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
jest.mock('@/services/team/teamService', () => ({ getTeams: () => Promise.resolve([]) }));

jest.mock('@/services/event/eventQueries', () => ({
  useGetEventTypes: () => ({
    data: mockDonnees.types, error: null, isLoading: false, refetch: () => {},
  }),
}));

// `useGetTeams` est une requete PAGINEE : l'ecran lit `data.pages[].data[]`.
// Rendre le tableau d'equipes directement donne une liste VIDE sans la moindre
// erreur — l'ecran affiche alors « Créer une équipe » et le tunnel s'arrete.
jest.mock('@/services/team/teamQueries', () => ({
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
  [RouteNames.EventWizardDetectionSlots]: EventWizardDetectionSlots,
  [RouteNames.EventWizardInvites]: EventWizardInvites,
  [RouteNames.EventWizardLocation]: EventWizardLocation,
  [RouteNames.EventWizardLogistics]: EventWizardLogistics,
  [RouteNames.EventWizardParticipants]: EventWizardParticipants,
  [RouteNames.EventWizardStageProgram]: EventWizardStageProgram,
  [RouteNames.EventWizardTeam]: EventWizardTeam,
  [RouteNames.EventWizardTournamentSettings]: EventWizardTournamentSettings,
  [RouteNames.EventWizardTournamentStructure]: EventWizardTournamentStructure,
  [RouteNames.EventWizardRecap]: EventWizardRecap,
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
  test('evenement standard : 8 ecrans, sans Invites, acces fusionne', () => {
    const marche = marcherDansLeTunnel({ nomDuType: 'Match' });
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
    expect(chaine).not.toContain(RouteNames.EventWizardInvites);
    expect(totalAnnonceALaFin(marche)).toBe(8);
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

  test('detection sur un sport a postes : 9 ecrans, creneaux inseres', () => {
    const marche = marcherDansLeTunnel({ nomDuType: 'Detection' });
    const { chaine } = marche;

    expect(chaine).toEqual([
      RouteNames.EventWizardType,
      RouteNames.EventWizardTeam,
      RouteNames.EventWizardLogistics,
      RouteNames.EventWizardLocation,
      RouteNames.EventWizardParticipants,
      RouteNames.EventWizardDetectionSlots,
      RouteNames.EventWizardAccess,
      RouteNames.EventWizardDescription,
      RouteNames.EventWizardRecap,
    ]);
    expect(totalAnnonceALaFin(marche)).toBe(9);
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

describe('D08 — le compteur du 1er ecran est calcule AVANT le choix du type', () => {
  // Bizarrerie mesuree le 2026-08-06, figee telle quelle : `EventWizardType`
  // calcule `stepCount` sur un etat dont `type` est encore nul. Il annonce donc
  // « 1/10 » meme quand le parcours choisi juste apres en compte 9 ou 11. Le
  // compte ne devient juste qu'a partir de l'ecran suivant.
  test.each([
    ['Tournoi', 10],
    ['Detection', 9],
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
    ['Detection', RouteNames.EventWizardDetectionSlots],
  ])('un parcours %s traverse %s', (nomDuType, ecran) => {
    expect(marcherDansLeTunnel({ nomDuType }).chaine).toContain(ecran);
  });

  test('le Recap mene aux invitations — le SEUL chemin restant', () => {
    // D08 a sorti `EventWizardInvites` de la chaine. Si ce lien disparait,
    // l'ecran (1 474 lignes) devient injoignable : c'est exactement la pire
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
    ['Match', 8],
    ['Stage', 8],
    ['Tournoi', 10],
    ['Detection', 9],
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
