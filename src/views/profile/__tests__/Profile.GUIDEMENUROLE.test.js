import { Alert, Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { PRESIDENT_GUIDE_SETTINGS } from '@/domains/tour/presidentGuideSettings';

import Profile from '../Profile';

// GUIDE-RELANCE (L6, 28/10) — audit du guide Entraîneur, décisions d'Adel :
// « 3- A » : relancer le guide depuis Mon compte quand on l'a déjà fait ouvre
// un petit menu (reprendre, revoir sans rien créer, faire un bonus) au lieu de
// tout refaire en vrai sans prévenir (capture 74) ; « 5- A » : un guide remis
// « plus tard » attend dans Mon compte, avec une pastille.
// Doublures reprises de `Profile.menuProfil.test.js` ; texte lu dans le VRAI fr.js.

/** @type {any} */
let mockUserData;
/** @type {any} */
let mockTour;
// RESA-OUVERTURE : COMPLEXES_GERANT allumé ; ce témoin ne parle pas du complexe.
jest.mock('@/views/complexe/components/EntreeComplexe', () => () => null);

jest.mock('@/context/useTour', () => ({ useTour: () => mockTour }));
// Le vrai guide Dirigeant, même interrupteur éteint : sans lui, le catalogue rend l'ancien tour.
jest.mock('@/domains/tour/tourCatalog', () => {
  const actual = jest.requireActual('@/domains/tour/tourCatalog');
  const { PRESIDENT_GUIDE } = jest.requireActual('@/domains/tour/presidentGuide');
  return {
    ...actual,
    getTourProfile: (key) => (key === 'president' && mockTour?.profileKey === 'president'
      ? PRESIDENT_GUIDE
      : actual.getTourProfile(key)),
  };
});

// MSG-SUPPORT (20/10) — « Écrire à l'assistance » ouvre MA conversation avec l'équipe
// (le serveur la crée à la première ouverture) : doublure du service, pas de réseau.
const mockOuvrirAssistance = jest.fn();
jest.mock('@/services/chat/assistanceService', () => ({
  ouvrirMaConversationAssistance: (/** @type {any[]} */ ...args) => mockOuvrirAssistance(...args),
}));

// PAR-L7 (13/10) — « Mon compte » d'un parent compte ses enfants (`useMesEnfantsEnBref`, qui lit
// trois services) : doublure commune, « aucun enfant ».
// R17-SIGNALER-1 : « Mes signalements » lit ses signalements (doublure, pas de reseau).
jest.mock('@/services/facilityReport/facilityReportQueries', () => ({
  useMyFacilityReports: () => ({ data: null }),
}));
jest.mock('@/views/profile/parent/useMesEnfantsEnBref');

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: () => {},
}));

// `react-native-gesture-handler` est publie en TypeScript non transpile et ne
// figure pas dans le `transformIgnorePatterns` du projet.
jest.mock('react-native-gesture-handler', () => ({
  ScrollView: jest.requireActual('react-native').ScrollView,
}));

jest.mock('@tanstack/react-query', () => ({
  useMutation: () => ({ isPending: false, mutate: jest.fn() }),
}));

jest.mock('react-i18next', () => {
  const catalogue = jest.requireActual('@/theme/strings/translations/fr').default;

  return {
    useTranslation: () => ({
      t: (/** @type {string} */ cle, /** @type {any} */ repli) => {
        const valeur = String(cle || '')
          .split('.')
          .reduce((noeud, segment) => (noeud == null ? undefined : noeud[segment]), catalogue);
        if (typeof valeur === 'string') return valeur;
        return typeof repli === 'string' ? repli : cle;
      },
    }),
  };
});

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({
    addAccount: jest.fn(),
    authSessions: [],
    canEditClub: () => false,
    canManageTeam: () => false,
    freeUsageSummary: null,
    logoutMutation: { mutate: jest.fn() },
    refetchUserData: jest.fn(),
    subscriptionAccessLevel: 'free',
    switchAccount: jest.fn(),
    userData: mockUserData,
    userDataError: null,
    userDataLoading: false,
  }),
}));

jest.mock('@/store/appContext', () => ({
  useAppContext: () => [{ fcmToken: 'token-test' }, jest.fn()],
}));

// Le VRAI theme, sans le contexte React qui le porte : un mock en Proxy rend les
// echecs Jest illisibles (constat du lot paywall, 2026-08-02).
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
      Images: {},
      Spaces: espaces,
    }),
  };
});

// COLLECTIVITES 1c — Profil lit `/collectivites/mine` (la porte « Ma collectivite ») :
// doublure, comme tout service que l ecran importe (le client HTTP ne se charge pas ici).
// RESA-L6B-1 — le nombre de « Mes réservations » (rangée cachée par COMPLEXES_JOUEUR) lit le
// serveur des complexes : doublé ici comme les autres services de « Mon compte ».
jest.mock('@/views/reserverTerrain/components/NombreAVenir', () => () => null);
jest.mock('@/services/collectivite/collectiviteQueries', () => ({
  // COLL-ACCUEIL (01/10) : la pastille de la rangee de la Ville lit les demandes en attente.
  useCollectiviteRequests: () => ({ data: [] }),
  useMyCollectivites: () => ({ data: [] }),
  useMyManagerRequests: () => ({ data: [] }),
}));

jest.mock('@/services/auth/authService', () => ({
  deleteAccount: jest.fn(),
}));

jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) { return children; },
);

jest.mock(
  '@/components/molecules/withDataWrapper/WithDataWrapper',
  () => function WithDataWrapperMock({ children }) { return children; },
);

jest.mock(
  '@/components/molecules/onboardingWrapper/OnboardingWrapper',
  () => function OnboardingWrapperMock({ children }) { return children; },
);

jest.mock(
  '@/components/molecules/tutorial/TutorialFlowBoundary',
  () => function TutorialFlowBoundaryMock({ children }) { return children; },
);

jest.mock(
  '@/components/molecules/bottomModal/BottomModal',
  () => function BottomModalMock() { return null; },
);

jest.mock(
  '@/components/molecules/profileAvatar/ProfileAvatar',
  () => function ProfileAvatarMock() { return null; },
);

jest.mock(
  '@/components/molecules/clubLogoMark/ClubLogoMark',
  () => function ClubLogoMarkMock() { return null; },
);

jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');

  return function ButtonMock(/** @type {any} */ props) {
    return reactActuel.createElement(
      PressableRN,
      { disabled: props.disabled, onPress: props.onPress },
      reactActuel.createElement(TexteRN, null, props.title),
    );
  };
});

/**
 * Aplati les enfants React en une chaîne.
 * @param {any} enfants - Enfants.
 * @returns {string} Texte.
 */
const aplatirTexte = (enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatirTexte).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatirTexte(enfants?.props?.children);
  return String(enfants);
};

const tourDe = (etat) => ({
  hasGuideHistory: false,
  isGuide: false,
  isTourActive: false,
  pauseTour: jest.fn(),
  resumeTour: jest.fn(),
  startTour: jest.fn(() => true),
  tourStatus: null,
  ...etat,
});

let arbre;
const CLUB = { documentId: 'club-1', name: 'AS Test' };
const monter = async (role = { name: 'Coach', type: 'coach' }, club = CLUB) => {
  mockUserData = {
    club,
    documentId: 'coach-1',
    firstname: 'Sam',
    lastname: 'Coach',
    multisportClubs: [],
    role,
  };
  await act(async () => {
    arbre = renderer.create(
      <Profile navigation={{ navigate: jest.fn(), setParams: jest.fn() }} route={{ params: {} }} />,
    );
  });
};
const toucher = async (libelle) => {
  const rangee = arbre.root.findAllByType(TouchableOpacity)
    .find((n) => n.findAllByType(Text).some((x) => aplatirTexte(x.props.children) === libelle));
  if (!rangee) throw new Error(`Rangée introuvable : ${libelle}`);
  await act(async () => { rangee.props.onPress(); });
};

afterEach(() => { act(() => arbre?.unmount()); });

const PRESIDENT = { name: 'President', type: 'president' };
const textes = () => arbre.root.findAllByType(Text).map((x) => aplatirTexte(x.props.children));
const rangeeDe = (libelle) => arbre.root.findAllByType(TouchableOpacity)
  .find((n) => n.findAllByType(Text).some((x) => aplatirTexte(x.props.children) === libelle));
// Guide entraîneur gardé sur le téléphone, remis « plus tard » quand ce compte était coach.
const coachEnPause = () => tourDe({
  hasGuideHistory: true,
  isGuide: true,
  isTourActive: true,
  profileKey: 'coach',
  restartTour: jest.fn(() => true),
  tourStatus: 'paused',
});

beforeEach(() => { jest.spyOn(Alert, 'alert').mockImplementation(() => {}); });
afterEach(() => { jest.restoreAllMocks(); });

// GUIDE-MENU-ROLE (testeur, feuille M1105, confirmé par Adel sur la 2.6.98, 10/11) : « Test
// Dirigeant » voyait « Guide entraîneur·e – En pause » et aucun « Guide dirigeant·e ». Le guide
// en cours (entraîneur, gardé sur le téléphone par personne, pas par rôle) passait avant celui du
// rôle. Voulu : le guide du rôle d'abord, l'autre en pause en second, aucun ne remplace l'autre.
describe('GUIDE-MENU-ROLE — le guide du rôle passe en premier', () => {
  it('précondition : le guide Dirigeant est allumé sur le téléphone', () => {
    expect(PRESIDENT_GUIDE_SETTINGS.enabled).toBe(true);
  });

  it('dirigeant sans historique : « Guide dirigeant·e » seul, qui lance son guide', async () => {
    mockTour = tourDe({});
    await monter(PRESIDENT);
    expect(textes()).toContain('Guide dirigeant·e');
    expect(textes()).not.toContain('Guide entraîneur·e');
    await toucher('Guide dirigeant·e');
    expect(mockTour.startTour).toHaveBeenCalledWith('president');
  });

  it('dirigeant avec un guide entraîneur en pause : les deux, le Dirigeant d’abord', async () => {
    mockTour = coachEnPause();
    await monter(PRESIDENT);
    const tous = textes();
    expect(tous).toContain('Guide dirigeant·e');
    expect(tous).toContain('Guide entraîneur·e');
    expect(tous.indexOf('Guide dirigeant·e')).toBeLessThan(tous.indexOf('Guide entraîneur·e'));
    // La pastille « En pause » est sur la rangée du guide entraîneur, pas sur celle du Dirigeant.
    expect(rangeeDe('Guide entraîneur·e').findAll((n) => n.props.testID === 'coachGuide-pause'))
      .not.toHaveLength(0);
    expect(rangeeDe('Guide dirigeant·e').findAll((n) => n.props.testID === 'coachGuide-pause'))
      .toHaveLength(0);
  });

  it('… le guide entraîneur garde son menu : Reprendre le reprend', async () => {
    mockTour = coachEnPause();
    await monter(PRESIDENT);
    await toucher('Guide entraîneur·e');
    expect(textes()).toContain('Reprendre là où j’en étais');
    await toucher('Reprendre là où j’en étais');
    expect(mockTour.resumeTour).toHaveBeenCalled();
    expect(mockTour.startTour).not.toHaveBeenCalled();
  });

  // GUIDE-PROGRESSIONS (Adel D45, « 222 B », 10/11) : chaque guide garde sa progression. Lancer le
  // Dirigeant range l'Entraîneur sans le remettre à zéro : plus de question qui l'annoncerait.
  it('… le guide Dirigeant part d’un toucher, l’Entraîneur garde sa progression', async () => {
    mockTour = coachEnPause();
    await monter(PRESIDENT);
    await toucher('Guide dirigeant·e');
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(mockTour.startTour).toHaveBeenCalledWith('president');
  });

  it('Dirigeant à l’écran, Entraîneur rangé : « En pause », Reprendre le ramène', async () => {
    mockTour = tourDe({
      hasGuideHistory: true,
      isGuide: true,
      isTourActive: true,
      parkedGuideKeys: ['coach'],
      profileKey: 'president',
      restartTour: jest.fn(() => true),
      tourStatus: 'active',
    });
    await monter(PRESIDENT);
    expect(textes()).toContain('Guide entraîneur·e');
    expect(rangeeDe('Guide entraîneur·e').findAll((n) => n.props.testID === 'coachGuide-pause'))
      .not.toHaveLength(0);
    await toucher('Guide entraîneur·e');
    expect(mockTour.startTour).not.toHaveBeenCalled();
    await toucher('Reprendre là où j’en étais');
    expect(mockTour.resumeTour).toHaveBeenCalledWith({ pop: true, profileKey: 'coach' });
  });

  it('dirigeant dont le guide ne peut pas démarrer (pas de club) : une phrase le dit', async () => {
    mockTour = tourDe({});
    await monter(PRESIDENT, null);
    expect(textes()).toContain('Guide dirigeant·e');
    expect(textes().some((x) => /club/i.test(x) && /guide|ouvr/i.test(x))).toBe(true);
    await toucher('Guide dirigeant·e');
    expect(mockTour.startTour).not.toHaveBeenCalled();
  });

  it('coach seul : « Guide entraîneur·e », pas de guide Dirigeant', async () => {
    mockTour = tourDe({});
    await monter();
    expect(textes()).toContain('Guide entraîneur·e');
    expect(textes()).not.toContain('Guide dirigeant·e');
    await toucher('Guide entraîneur·e');
    expect(mockTour.startTour).toHaveBeenCalledWith('coach');
  });

  it('coach devenu dirigeant en créant son club (« Moi ») : « Guide dirigeant·e »', async () => {
    mockTour = tourDe({ hasGuideHistory: true });
    await monter(PRESIDENT);
    expect(textes()).toContain('Guide dirigeant·e');
    expect(textes()).not.toContain('Guide entraîneur·e');
  });

  it('… club pas encore rattaché au profil : il retrouve son guide entraîneur', async () => {
    mockTour = tourDe({ hasGuideHistory: true });
    await monter(PRESIDENT, null);
    expect(textes()).toContain('Guide entraîneur·e');
  });
});
