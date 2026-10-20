import { Alert, Linking, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import FacilityList from '../FacilityList';

// D34 (E6) : FacilityList.js fait 580 lignes et n'avait AUCUN test, alors que
// l'ecran 03 du pack « Gerer mon club » lui demande de changer entierement de
// peau (carte peinte -> lisere + pastille, chips -> meta d'une ligne, bouton
// plein -> grammaire pointillee). Ce fichier fige le comportement AVANT la
// refonte et doit passer, INCHANGE, avant et apres.
//
// Il ne decrit volontairement AUCUN pixel : il observe ce qui part en
// navigation (`FacilityForm`), ce qui part sur le reseau (`deleteFacility`),
// ce que recoit la feuille de paywall, ce qui part vers la carte (`Linking`),
// et ce que l'ecran REFUSE de faire (installation partagee = pas de
// suppression). Une mise en page peut donc etre refaite de fond en comble sans
// qu'une seule ligne d'ici ne bouge.
//
// Seuil de tolerance assume : les gestes sont pilotes par le TEXTE VISIBLE,
// parce que c'est le seul point d'appui qui survit au passage de chips empilees
// a une meta d'une ligne.

/** @type {any[]} */
const mockButtonProps = [];
/** @type {any[]} */
const mockPaywallProps = [];
/** @type {any[]} */
const mockEmptyStateProps = [];

/** @type {any} */
let mockNavigation;
/** @type {any} */
let mockRoute;
/** @type {any} */
let mockFacilityContext;
/** @type {any} */
let mockUserData;

// R17-SIGNALER-1 : la carte et l accueil lisent le resume des signalements (doublure, pas de reseau).
jest.mock('@/services/facilityReport/facilityReportQueries', () => ({
  useCollectiviteFacilityReportsSummary: () => ({ data: null }),
}));
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: jest.fn(),
  useNavigation: () => mockNavigation,
  useRoute: () => mockRoute,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => (
      typeof repli === 'string' ? repli : cle
    ),
  }),
}));

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: mockUserData }),
}));

// Le VRAI theme, sans le contexte React qui le porte : un mock en Proxy rend
// les echecs Jest illisibles (constat du lot paywall, 2026-08-02), et un objet
// invente masquerait un jeton absent. `Images` est le seul element stub, pour
// ne pas faire dependre ce test de la resolution des fichiers d'assets.
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
      Images: { calendar: 3, edit: 2, pin: 1 },
      Spaces: espaces,
    }),
  };
});

// COLL1B : la doublure RETIENT aussi ce que l ecran demande (options du hook).
/** @type {any[]} */
const mockFacilityContextCalls = [];
jest.mock('@/services/facility/facilityQueries', () => ({
  useClubFacilityContext: (/** @type {any} */ contexte, /** @type {any} */ options) => {
    mockFacilityContextCalls.push({ contexte, options });
    return mockFacilityContext;
  },
}));

// COLL1C — le mode collectivite lit les installations de LA collectivite.
/** @type {any} */
const mockCollectiviteInstallations = { data: undefined, isLoading: false, refetch: jest.fn() };
// COLL-C2B (02/10) : la liste de la Ville lit la semaine de chaque installation (son planning) et
// range ses gestes dans une feuille du bas ; deux doublures, sans effet cote club.
jest.mock('@/services/seasonSlot/seasonSlotQueries', () => ({
  useInstallationsWeekSummary: () => ({}),
}));
jest.mock('@/components/molecules/bottomModal/BottomModal', () => function BottomModalMock(
  /** @type {any} */ { children, isVisible },
) {
  return isVisible ? children : null;
});

jest.mock('@/services/collectivite/collectiviteQueries', () => ({
  useCollectiviteInstallations: () => mockCollectiviteInstallations,
  useMyCollectivites: () => ({ data: [] }),
}));

// Le service est double ENTIEREMENT, fonctions pures comprises : le module
// importe le client HTTP, qui refuse de se charger sans `API_URL` (piege paye
// au lot L35, 2026-08-05). `getFacilitySections` est donc reimplemente ici a
// l'identique de la source, et non `requireActual`.
// COLL-C4B-BIS (03/10) : la carte d une installation de la Ville lit sa fermeture (bandeau).
jest.mock('@/services/facilityClosure/facilityClosureQueries', () => ({
  useFacilityClosures: () => ({ data: null }),
}));
jest.mock('@/services/facility/facilityService', () => ({
  deleteFacility: jest.fn(),
  getFacilitySections: (/** @type {any[]} */ installations, /** @type {any} */ libelles = {}) => {
    if (!Array.isArray(installations) || installations.length === 0) return [];

    const titreClub = libelles.clubTitle || 'Installations du club';
    const titrePartage = libelles.sharedTitle || 'Installations partagées';
    const propres = installations.filter((installation) => !installation?.isShared);
    const partagees = installations.filter((installation) => installation?.isShared);

    if (propres.length > 0 && partagees.length > 0) {
      return [
        { data: propres, title: titreClub },
        { data: partagees, title: titrePartage },
      ];
    }
    if (partagees.length > 0) return [{ data: partagees, title: titrePartage }];
    return [{ data: propres, title: titreClub }];
  },
}));

// Valeur FIGEE hors de la fabrique : un double de hook qui rend un objet neuf a
// chaque appel fait tourner Jest en boucle infinie, sans message.
const dispositionFigee = { sceneBottomInset: 24 };
jest.mock('@/navigation/useBottomDockLayout', () => ({
  __esModule: true,
  default: () => dispositionFigee,
}));

jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) {
    return children;
  },
);

jest.mock('@/components/atoms/loader/Loader', () => function LoaderMock() {
  return null;
});

jest.mock('@/components/atoms/emptyState/EmptyState', () => function EmptyStateMock(
  /** @type {any} */ props,
) {
  mockEmptyStateProps.push(props);
  return null;
});

// Le bouton est rendu comme un vrai element pressable portant son libelle :
// c'est ce qui permet aux tests d'appuyer « sur le texte », que le libelle soit
// porte par un Button (avant) ou par un TouchableOpacity (apres).
jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');

  return function ButtonMock(/** @type {any} */ props) {
    mockButtonProps.push(props);
    return reactActuel.createElement(
      PressableRN,
      { disabled: props.disabled || props.isLoading, onPress: props.onPress },
      reactActuel.createElement(TexteRN, null, props.title),
    );
  };
});

jest.mock(
  '@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet',
  () => function SubscriptionPaywallSheetMock(/** @type {any} */ props) {
    mockPaywallProps.push(props);
    return null;
  },
);

const INSTALLATION_CLUB = {
  address: {
    description: '21 rue Fortia, Marseille',
    geometry: { coordinates: [5.37, 43.29] },
  },
  documentId: 'fac-1',
  maxSlots: 1,
  name: 'Gymnase',
  type: 'Terrain',
};

// `SectionList` planifie ses lots via un `Batchinator` qui appelle
// `InteractionManager` sur un `setTimeout`. Si l'arbre survit a la fin du test,
// ce minuteur se declenche APRES le demontage de l'environnement Jest et fait
// tomber le processus entier — sans rapport avec le code teste. On demonte
// donc explicitement tout ce qu'on a monte.
/** @type {any[]} */
const arbresMontes = [];

/**
 * Rend l'ecran et retourne son arbre.
 * @returns {any} L'arbre rendu.
 */
const rendre = () => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(<FacilityList />);
  });
  arbresMontes.push(arbre);
  return arbre;
};

/**
 * Aplatit les enfants d'un noeud en une chaine.
 * @param {any} enfants - Les enfants du noeud.
 * @returns {string} Le texte aplati.
 */
const aplatirTexte = (enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatirTexte).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatirTexte(enfants?.props?.children);
  return String(enfants);
};

/**
 * Texte visible sous un noeud de l'arbre rendu.
 * @param {any} noeud - Le noeud observe.
 * @returns {string} Le texte visible.
 */
const texteDe = (noeud) => noeud
  .findAllByType(Text)
  .map((/** @type {any} */ texte) => aplatirTexte(texte.props.children))
  .join(' ');

/**
 * Tout le texte visible de l'arbre, en une seule chaine.
 * @param {any} arbre - L'arbre rendu.
 * @returns {string} Le texte visible.
 */
const textesVisibles = (arbre) => texteDe(arbre.root);

beforeEach(() => {
  jest.clearAllMocks();
  mockButtonProps.length = 0;
  mockPaywallProps.length = 0;
  mockEmptyStateProps.length = 0;
  mockFacilityContextCalls.length = 0;

  mockNavigation = { goBack: jest.fn(), navigate: jest.fn() };
  mockRoute = { params: { clubId: 'club-1', cmId: null } };
  mockUserData = { club: { documentId: 'club-1' } };
  mockFacilityContext = {
    data: { allFacilities: [INSTALLATION_CLUB], cmId: null },
    error: null,
    isLoading: false,
    isRefetching: false,
    refetch: jest.fn(),
  };

  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(true);
  jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
});

afterEach(() => {
  act(() => {
    arbresMontes.splice(0).forEach((arbre) => arbre.unmount());
  });
  jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// COLL1D (29/09) — restes du lot 1b (SPEC §7) et types des mairies (D28), cote CLUB :
// la carte d une installation annonce ses horaires d ouverture, et un type s affiche par
// son libelle. ROUGE avant le lot : horaires en mode collectivite seulement, type brut.
// Harnais repris de FacilityList.test.js (memes doublures).
// ---------------------------------------------------------------------------
const INSTALLATION_DE_LA_VILLE = {
  address: { description: '1 avenue du Stade, Demo' },
  closingTime: '22:00:00.000',
  collectivite: { documentId: 'ville-demo', name: 'Ville de Demo' },
  documentId: 'gym-ville',
  isReadOnly: true,
  isShared: true,
  maxSlots: 2,
  name: 'Gymnase de la Ville',
  openingTime: '08:00:00.000',
  ownerName: 'Ville de Demo',
  ownerType: 'collectivite',
  type: 'Gymnase',
};

describe('COLL1D — la carte d une installation, cote CLUB', () => {
  // Recus du serveur depuis le lot 1b, jamais affiches jusqu ici.
  it('le gymnase de la Ville annonce ses HORAIRES d ouverture', () => {
    mockFacilityContext.data = {
      allFacilities: [INSTALLATION_CLUB, INSTALLATION_DE_LA_VILLE],
      cmId: null,
    };
    const textes = textesVisibles(rendre());

    expect(textes).toContain('08:00 – 22:00');
  });

  it('une installation sans horaires n en invente pas', () => {
    mockFacilityContext.data = { allFacilities: [INSTALLATION_CLUB], cmId: null };
    expect(textesVisibles(rendre())).not.toMatch(/\d{2}:\d{2} – \d{2}:\d{2}/);
  });

  it('un type neuf s affiche par son libelle (« Piste d’athlétisme »), pas sa valeur', () => {
    mockFacilityContext.data = {
      allFacilities: [{
        ...INSTALLATION_DE_LA_VILLE,
        name: 'Stade Jean Bouin',
        type: 'Piste d\'athlétisme',
      }],
      cmId: null,
    };
    const textes = textesVisibles(rendre());

    expect(textes).toContain('Piste d’athlétisme');
    expect(textes).not.toContain('Piste d\'athlétisme');
  });
});

jest.mock(
  '@/components/atoms/skeletonLoader/SkeletonLoader',
  () => function SkeletonMock({ children }) { return children; },
);
jest.mock('@/context/AppFeedbackContext', () => ({
  useAppFeedback: () => ({ showBanner: jest.fn() }),
}));

// R17-PLANNING (20/10) : la section « Planning de toutes les installations » a son propre témoin
// (PlanningDesInstallations.R17PLAN.test.js) ; ici elle est doublée.
jest.mock(
  '@/components/organisms/planning/PlanningDesInstallations',
  () => function PlanningDesInstallationsDouble() { return null; },
);
