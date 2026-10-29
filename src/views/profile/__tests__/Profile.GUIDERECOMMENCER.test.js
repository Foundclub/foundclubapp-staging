import { Alert, Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

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
jest.mock('@/context/useTour', () => ({ useTour: () => mockTour }));

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
const monter = async () => {
  mockUserData = {
    club: { documentId: 'club-1', name: 'AS Test' },
    documentId: 'coach-1',
    firstname: 'Sam',
    lastname: 'Coach',
    multisportClubs: [],
    role: { name: 'Coach', type: 'coach' },
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

// GUIDE-RECOMMENCER (décision d'Adel 29/10 « 5- B ») : « Recommencer à zéro » dans le
// menu du guide, avec une confirmation ; seule la progression repart de zéro.
const rangeeDe = (libelle) => arbre.root.findAllByType(TouchableOpacity)
  .find((n) => n.findAllByType(Text).some((x) => aplatirTexte(x.props.children) === libelle));

describe('GUIDE-RECOMMENCER — « Recommencer à zéro » dans Mon compte', () => {
  let alertSpy;
  beforeEach(() => { alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {}); });
  afterEach(() => alertSpy.mockRestore());

  it.each([
    ['fini', { hasGuideHistory: true }],
    ['en pause', {
      hasGuideHistory: true, isGuide: true, isTourActive: true, tourStatus: 'paused',
    }],
    ['en cours', {
      hasGuideHistory: true, isGuide: true, isTourActive: true, tourStatus: 'active',
    }],
  ])('guide %s : le choix est dans le menu, en retrait', async (_nom, etat) => {
    mockTour = tourDe({ ...etat, restartTour: jest.fn(() => true) });
    await monter();
    await toucher('Guide entraîneur·e');
    const rangee = rangeeDe('Recommencer à zéro');
    expect(rangee).toBeDefined();
    expect(Object.assign({}, ...[rangee.props.style].flat(5).filter(Boolean)).marginLeft)
      .toBeGreaterThanOrEqual(24);
  });

  it('jamais lancé : pas de menu, donc pas de « Recommencer »', async () => {
    mockTour = tourDe({ restartTour: jest.fn(() => true) });
    await monter();
    expect(rangeeDe('Recommencer à zéro')).toBeUndefined();
  });

  it('une confirmation d’abord : Annuler ne fait rien, Recommencer relance', async () => {
    mockTour = tourDe({ hasGuideHistory: true, restartTour: jest.fn(() => true) });
    await monter();
    await toucher('Guide entraîneur·e');
    await toucher('Recommencer à zéro');
    expect(mockTour.restartTour).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledTimes(1);
    const [titre, message, boutons] = alertSpy.mock.calls[0];
    expect(titre).toBe('Recommencer le guide ?');
    expect(message).toBe('Ta progression repart de zéro. Rien de ce que tu as créé n’est effacé.');
    expect(boutons.map((b) => b.text)).toEqual(['Annuler', 'Recommencer']);
    act(() => { boutons[0].onPress?.(); });
    expect(mockTour.restartTour).not.toHaveBeenCalled();
    act(() => { boutons[1].onPress(); });
    expect(mockTour.restartTour).toHaveBeenCalledWith('coach');
    expect(mockTour.startTour).not.toHaveBeenCalled();
  });
});
